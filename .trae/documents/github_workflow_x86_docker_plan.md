# GitHub Actions 构建 x86 Docker 镜像 — 实施计划

> 生成日期：2026-09-03 | 状态：待用户确认

---

## 1. 项目摘要（Summary）

为现有钉钉打卡提醒 Web 系统添加 GitHub Actions 工作流，在以下三种情况下自动构建并推送 **x86 (linux/amd64)** 架构的 Docker 镜像到 **GitHub Container Registry (ghcr.io)**：

- `main` 分支发生 `push`
- 推送形如 `v*.*.*` 的 tag
- 手动触发 (`workflow_dispatch`)

构建范围覆盖前后端两个服务：

- `ghcr.io/<owner>/<repo>/backend:<标签>`
- `ghcr.io/<owner>/<repo>/frontend:<标签>`

敏感配置 `config.json` 不进入仓库，也不在镜像中固化；运行时通过宿主机 Volume 挂载注入。

---

## 2. 当前现状分析（Current State Analysis）

### 2.1 已有资产

| 文件 | 说明 |
|------|------|
| `backend/Dockerfile` | Python 3.11 + FastAPI，多依赖安装 |
| `frontend/Dockerfile` | Node 20 多阶段构建 → Nginx Alpine |
| `docker-compose.yml` | 本地通过 `build: ./backend` / `build: ./frontend` 编排 |
| `.dockerignore` | 忽略 node_modules、dist、__pycache__ 等 |
| `config.json` | 包含 API Key、DST ID、webhook 等敏感信息 |

### 2.2 缺失项

- 无 `.github/workflows/`，无 CI/CD 流水线
- `docker-compose.yml` 使用本地 `build` 上下文，不能直接复用预构建的 ghcr.io 镜像
- 未定义镜像 tag 策略
- 未定义敏感配置在 CI 中的处理方式

### 2.3 约束

- 用户明确要求 **x86** 镜像 → 使用 `linux/amd64` 平台
- 镜像仓库限定为 **ghcr.io** → 使用 `GITHUB_TOKEN` 登录，无需额外 Docker Hub 账号
- 敏感配置不上传仓库 → 镜像中不打包 `config.json`

---

## 3. 产品/技术决策（Decisions）

| 议题 | 决策 | 说明 |
|------|------|------|
| 目标平台 | `linux/amd64` | 用户指定的 x86 架构 |
| 镜像仓库 | ghcr.io | 与 GitHub 集成，使用 `GITHUB_TOKEN` |
| 构建范围 | backend + frontend | 与 docker-compose 两个服务对应 |
| 触发条件 | push main / push tag (v*) / workflow_dispatch | 满足自动构建与手动发布 |
| Tag 策略 | `latest` + `sha-<short>` + tag 名 | main 分支推 latest 和 sha；tag 推送 tag 名和 latest |
| 敏感配置 | 不进入镜像 | 运行时通过 Volume 挂载 `config.json` |
| docker-compose 调整 | 增加 `image` 字段并保留 `build` 可选 | 既支持 CI 拉取预构建镜像，也保留本地构建能力 |

---

## 4. 实施计划（Proposed Changes）

### 4.1 新增 GitHub Actions 工作流

**新增文件**：`.github/workflows/docker-build.yml`

**内容要点**：

1. **触发条件**
   ```yaml
   on:
     push:
       branches: [main]
       tags: ['v*.*.*']
     workflow_dispatch:
   ```

2. **权限**
   ```yaml
   permissions:
     contents: read
     packages: write
   ```

3. **变量与步骤**
   - 使用 `actions/checkout@v4` 检出代码
   - 使用 `docker/setup-qemu-action@v3` 安装 QEMU（用于跨平台构建）
   - 使用 `docker/setup-buildx-action@v3` 启用 Buildx
   - 使用 `docker/login-action@v3` 登录 ghcr.io
   - 使用 `docker/metadata-action@v5` 生成镜像标签（`latest`、`sha-<short>`、`v*.*.*`）
   - 使用 `docker/build-push-action@v6` 构建并推送 backend 和 frontend 镜像
   - `platforms: linux/amd64`
   - `push: true`
   - `cache-from` / `cache-to` 使用 GitHub Actions Cache（gha）加速后续构建

4. **镜像命名**
   - backend: `ghcr.io/${{ github.repository_owner }}/${{ github.event.repository.name }}/backend`
   - frontend: `ghcr.io/${{ github.repository_owner }}/${{ github.event.repository.name }}/frontend`

### 4.2 调整 docker-compose.yml（可选但推荐）

**修改文件**：`docker-compose.yml`

**调整内容**：
- 为 `backend` 和 `frontend` 增加 `image` 字段，指向 ghcr.io 镜像
- 保留 `build: ./backend` / `build: ./frontend`，让本地仍可 `docker-compose up -d --build`
- 这样 NAS 上既可以直接 `docker-compose pull && up -d` 使用预构建镜像，也可以本地重新构建

**示例**：
```yaml
services:
  backend:
    image: ghcr.io/<owner>/<repo>/backend:latest
    build: ./backend
    ...
  frontend:
    image: ghcr.io/<owner>/<repo>/frontend:latest
    build: ./frontend
    ...
```

### 4.3 确保 config.json 不会被意外提交

**检查/新增文件**：`.gitignore`

**内容**：
```gitignore
config.json
data.json
*.db
__pycache__/
*.pyc
node_modules/
dist/
.env
```

说明：`config.json` 和 `data.json` 含敏感信息，不应进入仓库。CI 构建镜像时不依赖这些文件；运行时通过 Volume 挂载。

### 4.4 README/部署说明补充（可选）

**修改文件**：`PRD_钉钉打卡提醒系统Web版.md` 或新增简短 `DEPLOY.md`

补充 NAS 部署命令：
```bash
# 登录 GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# 拉取最新镜像并启动
docker-compose pull
docker-compose up -d
```

---

## 5. 假设与风险（Assumptions & Risks）

### 5.1 假设

- 仓库已推送到 GitHub，且用户有权限配置 Actions Secrets 和工作流
- GitHub 仓库已开启 Packages 写入权限（默认 `GITHUB_TOKEN` 需要 `packages: write`）
- NAS 或目标运行环境可以访问 ghcr.io
- 用户后续会在 NAS 上准备好 `config.json` 并通过 Volume 挂载

### 5.2 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| ghcr.io 访问受限 | NAS 无法拉取镜像 | 提供本地构建的 fallback（保留 `build` 字段） |
| 镜像 tag 策略冲突 | latest 被非稳定版本覆盖 | tag 发布时同时打 tag 名和 latest，main 分支只打 latest 和 sha |
| config.json 误提交 | 敏感信息泄露 | `.gitignore` 明确排除，并在 CI 中不打包 |
| 构建缓存失效 | 首次构建较慢 | 使用 `cache-to: type=gha,mode=max` 缓存层 |

---

## 6. 验证步骤（Verification Steps）

### 6.1 工作流语法检查

将代码推送到 GitHub 后：
1. 进入仓库 `Actions` 标签页
2. 确认工作流 `Build and Push Docker Images` 已出现
3. 检查 YAML 文件无红色报错提示

### 6.2 自动触发验证

1. 向 `main` 分支 push 一个空提交或代码变更
2. 观察 Actions 运行，确认出现两个 job（backend + frontend）
3. 等待构建完成，状态为 ✅

### 6.3 镜像推送验证

1. 进入仓库 `Packages` 标签页
2. 确认出现 `backend` 和 `frontend` 两个包
3. 确认标签包含 `latest` 和 `sha-<short>`

### 6.4 Tag 发布验证

1. 本地执行 `git tag v1.0.0 && git push origin v1.0.0`
2. 观察 Actions 再次触发
3. 确认 Packages 中出现 `v1.0.0` 标签

### 6.5 NAS 拉取验证

1. 在 NAS 上登录 ghcr.io
2. 执行 `docker-compose pull`
3. 确认拉取到 `ghcr.io/<owner>/<repo>/backend:latest` 和 `frontend:latest`
4. 执行 `docker-compose up -d`，确认服务启动

---

## 7. 后续可扩展项（Out of Scope）

以下功能已记录但不纳入本期：

1. **多架构镜像**（arm64）：当前仅实现 x86 (`linux/amd64`)，如需 arm64 可扩展 `platforms: linux/amd64,linux/arm64`
2. **镜像签名 (cosign)**：增强镜像供应链安全
3. **SBOM / 漏洞扫描**：使用 `anchore/scan-action` 或 Docker Scout
4. **自动发布 Release Notes**：tag 发布时自动生成 GitHub Release
5. **Helm / K8s 部署清单**：当前仅保留 docker-compose 方式

---

## 8. 总结

本期将交付一个 **GitHub Actions 工作流**，实现：

- push `main`、push `v*.*.*` tag、手动触发时自动构建
- 为 `backend` 和 `frontend` 分别构建 `linux/amd64` 镜像
- 推送到 `ghcr.io/<owner>/<repo>/backend` 和 `/frontend`
- Tag 策略：`latest` + `sha-<short>` + tag 名
- 不打包敏感配置，保留本地构建能力

确认本计划后，将按「新增 `.github/workflows/docker-build.yml` → 调整 `docker-compose.yml` → 检查 `.gitignore` → 验证工作流」的顺序实施。
