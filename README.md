# 钉钉打卡提醒系统 Web 版

> 将原有的 Python 单文件脚本升级为前后端分离的 Web 系统，支持可视化排班、班次管理、实时 Dashboard、分级日志和 Docker 一键部署。

---

## 1. 项目概述

### 1.1 背景

原系统是一个 Python 脚本 `dingding_TX.py`，通过 crontab 每分钟执行一次：

- 读取 `data.json` 排班表判断今日班次（A 班 / P 班）
- 在上班前 15 分钟、下班后 30 分钟内进入打卡提醒窗口
- 调用维格表 API 查询云端打卡状态，避免重复推送
- 通过飞书 webhook + fwalert webhook 双通道推送提醒
- 将云端状态回写 `config.json`

### 1.2 痛点

| 痛点 | 原脚本方案 | Web 版方案 |
|------|-----------|-----------|
| 排班维护 | 手写三层 JSON，易出错 | 日历点击可视化编辑 |
| 班次扩展 | A/P 两班时间硬编码 | 任意新增班次模板 |
| 配置修改 | SSH 改 JSON | Web 表单即时保存 |
| 日志查看 | `tail -f` 文件 | 页面分页筛选 |
| 状态感知 | 无 | Dashboard 实时展示 |
| 部署方式 | Python + crontab | Docker Compose 一键部署 |

### 1.3 目标

在 NAS / 服务器上通过 Docker 部署，浏览器访问即可完成所有操作。

---

## 2. 目录结构

```text
.
├── .github/workflows/docker-build.yml   # GitHub Actions CI/CD：构建 x86 Docker 镜像并推送到 GHCR
├── backend/                               # FastAPI 后端服务
│   ├── Dockerfile                         # 后端镜像构建（基于 python:3.11-slim，Asia/Shanghai 时区）
│   ├── requirements.txt                   # Python 依赖清单
│   ├── main.py                            # FastAPI 应用入口：注册路由、初始化数据库、启动定时器
│   ├── database.py                        # SQLite + SQLAlchemy 引擎与会话管理
│   ├── models.py                          # 数据表模型：班次、排班、日志、配置
│   ├── engine.py                          # 核心打卡检查引擎（每分钟执行）
│   ├── scheduler.py                       # APScheduler 定时任务封装
│   ├── seed.py                            # 初始化默认班次与读取 config.json 配置
│   ├── services/push.py                   # 推送服务：飞书、fwalert、分级日志写入
│   └── routers/                           # API 路由模块
│       ├── config.py                      # GET/POST /api/config 系统配置
│       ├── dashboard.py                   # GET /api/dashboard 今日状态总览
│       ├── import_data.py                 # POST /api/import/schedule-json 排班 JSON 导入
│       ├── logs.py                        # GET /api/logs 推送日志查询与统计
│       ├── schedule.py                    # GET/POST /api/schedule 排班日历接口
│       ├── shifts.py                      # CRUD /api/shifts 班次模板管理
│       └── skip.py                        # POST/GET /api/skip/today 今日跳过提醒
├── frontend/                              # React + TypeScript 前端
│   ├── Dockerfile                         # 前端镜像构建（Vite 构建 + Nginx 托管）
│   ├── nginx.conf                         # Nginx 配置：静态文件 + /api 反向代理
│   ├── package.json                       # npm 依赖与脚本
│   ├── vite.config.ts                     # Vite 构建配置
│   ├── tsconfig.json                      # TypeScript 配置
│   ├── index.html                         # 应用入口 HTML
│   └── src/
│       ├── main.tsx                       # React 应用挂载
│       ├── App.tsx                        # 路由配置（React Router）
│       ├── index.css                      # 全局样式
│       ├── api/index.ts                   # Axios 实例（baseURL=/api）
│       ├── components/Layout.tsx          # 侧边栏 + 顶栏布局
│       └── pages/
│           ├── Dashboard.tsx              # 首页仪表盘：今日班次、打卡窗口、云端状态
│           ├── Shifts.tsx                 # 班次管理：新建/编辑/删除班次
│           ├── Schedule.tsx               # 排班日历：月视图点击设置班次
│           ├── Logs.tsx                   # 推送日志：筛选、分页、分级显示
│           └── Settings.tsx               # 系统设置：核心配置 + 数据导入 + 扩展通知预留
├── docs/
│   └── PRD.md                             # 产品需求文档（历史版本，v2.0）
├── scripts/
│   └── dingding_TX.py                     # 原 Python 单文件脚本（已归档，供参考）
├── docker-compose.yml                     # Docker Compose 编排（前后端 + 持久化卷）
├── .env.example                           # 环境变量模板（镜像前缀、标签）
├── .dockerignore                          # Docker 构建忽略规则
└── .gitignore                             # Git 忽略规则
```

---

## 3. 每个文件的作用

### 3.1 构建与部署

| 文件 | 作用 |
|------|------|
| `docker-compose.yml` | 定义 `backend`、`frontend` 两个服务，使用 `dingding_data` 卷持久化 SQLite 数据库，前端暴露 80 端口，后端通过 Nginx 反向代理访问。 |
| `.env.example` | 示例环境变量：`DOCKER_REGISTRY`、`DOCKER_IMAGE_PREFIX`、`DOCKER_TAG`，用于指定拉取的镜像地址。 |
| `.github/workflows/docker-build.yml` | GitHub Actions 工作流：push 到 `main` 或打 `v*.*.*` tag 时自动构建 linux/amd64 镜像，推送到 `ghcr.io/<repo>/backend` 与 `ghcr.io/<repo>/frontend`，同时导出 tar 工件。 |
| `backend/Dockerfile` | 构建后端镜像，设置中国时区（Asia/Shanghai），安装依赖，启动 uvicorn。 |
| `frontend/Dockerfile` | 两阶段构建：Node 构建 React 静态产物，Nginx 托管静态文件并加载自定义配置。 |
| `frontend/nginx.conf` | Nginx 监听 80 端口，`/api/` 反向代理到 `backend:8000`，其余路径返回前端单页应用。 |
| `.dockerignore` | 排除 `node_modules`、`dist`、IDE 配置、敏感文件等，减小镜像体积。 |

### 3.2 后端

| 文件 | 作用 |
|------|------|
| `backend/main.py` | FastAPI 入口。配置 CORS、创建数据库表、初始化默认数据、启动 APScheduler、注册所有路由。 |
| `backend/database.py` | 通过环境变量 `DATABASE_URL`（默认 `sqlite:////data/dingding.db`）创建引擎和会话。 |
| `backend/models.py` | SQLAlchemy 模型：`ShiftTemplate`（班次模板）、`Schedule`（每日排班）、`PushLog`（推送日志，含 `level` 字段）、`SystemConfig`（键值对配置）。 |
| `backend/engine.py` | 核心引擎。每分钟执行：重置每日状态 → 检查是否跳过 → 查询今日排班 → 判断打卡窗口 → 查询维格表 → 双通道推送 → 更新本地状态。 |
| `backend/scheduler.py` | 封装 APScheduler，`CronTrigger(minute="*")` 每分钟触发一次 `run_check`。 |
| `backend/seed.py` | 启动时初始化默认班次（A 班、P 班、休），并从 `config.json` 导入历史配置到 `SystemConfig`。 |
| `backend/services/push.py` | 实现 `push_feishu`、`push_fwalert`、统一入口 `push_all`，以及 `log_info`/`log_warn`/`log_error` 分级日志函数。 |
| `backend/routers/config.py` | 系统配置的增删改查，维护 `DEFAULT_CONFIG_KEYS` 默认值。 |
| `backend/routers/dashboard.py` | 返回今日日期、当前时间、班次、打卡窗口、云端打卡状态、是否跳过。 |
| `backend/routers/shifts.py` | 班次模板的 CRUD，时间字符串与 `datetime.time` 互转。 |
| `backend/routers/schedule.py` | 按年月查询排班、按日期范围查询、设置某日排班。 |
| `backend/routers/logs.py` | 分页查询推送日志，支持按类型、渠道、结果、级别、日期范围、关键词筛选；`/logs/stats` 返回统计。 |
| `backend/routers/import_data.py` | 接收上传的 JSON 文件，自动创建班次模板并覆盖/写入排班数据。 |
| `backend/routers/skip.py` | 设置或查询今日是否跳过打卡提醒。 |

### 3.3 前端

| 文件 | 作用 |
|------|------|
| `frontend/src/App.tsx` | 定义 `/dashboard`、`/shifts`、`/schedule`、`/logs`、`/settings` 路由。 |
| `frontend/src/api/index.ts` | Axios 实例，请求后端 `/api`。 |
| `frontend/src/components/Layout.tsx` | Ant Design Layout：左侧菜单导航、顶部标题栏。 |
| `frontend/src/pages/Dashboard.tsx` | 仪表盘：展示今日班次、上下班窗口、云端状态、跳过按钮，每 30 秒自动刷新。 |
| `frontend/src/pages/Shifts.tsx` | 班次管理表格与弹窗表单，支持颜色选择器、时间选择器、开关等。 |
| `frontend/src/pages/Schedule.tsx` | Ant Design Calendar 月视图，日期格显示班次标签，点击日期弹窗修改。 |
| `frontend/src/pages/Logs.tsx` | 日志表格，支持按级别（info/warning/error）、类型、渠道、结果、日期、关键词筛选。 |
| `frontend/src/pages/Settings.tsx` | 三栏 Tabs：核心配置、数据导入、扩展通知（邮件/短信预留字段）。 |

### 3.4 文档与归档

| 文件 | 作用 |
|------|------|
| `docs/PRD.md` | 产品需求文档，记录从 Python 脚本升级到 Web 版的原始需求、功能模块、技术方案。 |
| `scripts/dingding_TX.py` | 原始 Python 脚本归档，保留历史逻辑供参考，不再参与运行。 |

---

## 4. 已实现功能

### 4.1 Web 管理

- [x] 可视化排班日历（月视图，点击设置班次）
- [x] 班次模板管理（新建、编辑、删除，支持颜色、时间、提醒窗口、休息类型）
- [x] 实时 Dashboard（今日班次、打卡窗口状态、云端打卡状态、今日跳过）
- [x] 系统设置 Web 化（维格表 API Key、DST ID、飞书/fwalert webhook、日志保留天数）
- [x] 历史 `data.json` 一键导入，自动创建缺失班次并覆盖排班

### 4.2 提醒引擎

- [x] APScheduler 每分钟自动检查打卡窗口
- [x] 上班窗口：`上班时间 - remind_before_min` 至 `上班时间`
- [x] 下班窗口：`下班时间 + overtime_min` 至 `下班时间 + overtime_min + remind_after_min`
- [x] 查询维格表云端打卡状态，避免重复推送
- [x] 双通道推送：飞书 webhook + fwalert webhook
- [x] 本地状态每日自动重置，防止跨天错误
- [x] 支持「今日跳过」临时关闭提醒
- [x] Asia/Shanghai 时区处理，避免 Docker 容器时间偏差

### 4.3 日志

- [x] 推送与系统日志统一写入 SQLite
- [x] 日志分级：`info` / `warning` / `error`
- [x] 日志页面支持级别、类型、渠道、结果、日期、关键词筛选
- [x] 每次打卡检查、每次推送都有详细日志，便于排查

### 4.4 部署与 CI/CD

- [x] Docker Compose 一键部署
- [x] GitHub Actions 自动构建 x86 Docker 镜像
- [x] 镜像推送到 GitHub Container Registry（GHCR）
- [x] 同时导出 backend/frontend tar 工件

---

## 5. 你的需求（产品目标）

根据原始沟通，核心需求可归纳为：

1. **网页版替代脚本版**：保留原 Python 脚本所有功能，全部迁移到 Web 页面操作。
2. **班次可视化**：在网页上显示班次，并能通过日历管理排班。
3. **日志可视化**：在网页上查看推送日志和运行日志，支持筛选。
4. **分级日志**：为解决部署后无法发送提醒的问题，需要 info/warning/error 三级日志，方便排查。
5. **Docker 化部署**：通过 GitHub Actions 编译 x86 Docker 镜像，并提供可直接使用的 `docker-compose.yml`。
6. **时区正确**：容器内使用北京时间，保证打卡窗口判断准确。
7. **状态每日重置**：避免前一天已打卡影响第二天推送。

---

## 6. 快速部署

### 6.1 使用预构建镜像

```bash
# 1. 克隆仓库
git clone <repo-url>
cd dingding-web

# 2. 复制环境变量模板并修改
cp .env.example .env
# 编辑 .env，填入你的镜像前缀，例如：
# DOCKER_REGISTRY=ghcr.io
# DOCKER_IMAGE_PREFIX=1316575628/Dingding_dyson
# DOCKER_TAG=latest

# 3. 创建 config.json（可选，用于初始化配置）
# 如果已有历史 config.json，可放到与 docker-compose.yml 同级目录
# 否则首次启动后在「系统设置」页面填写即可

# 4. 启动
docker-compose pull && docker-compose up -d

# 5. 访问
http://<nas-ip>
```

### 6.2 本地构建

```bash
docker-compose up -d --build
```

### 6.3 端口说明

- `80`：前端 Nginx（默认映射到宿主机 80，若被占用可修改 `docker-compose.yml` 的 `ports`）
- `8000`：后端 FastAPI（不直接暴露，通过 Nginx `/api/` 代理）

---

## 7. 首次配置

1. 打开 `http://<nas-ip>/settings`
2. 填入：
   - 维格表 API Key
   - 维格表 DST ID
   - 飞书 Webhook
   - fwalert Webhook
   - 日志保留天数（默认 7）
3. 进入「班次管理」确认默认班次（A 班、P 班、休）
4. 进入「排班日历」设置未来日期班次
5. 或进入「系统设置」→「数据导入」上传原 `data.json`
6. 回到 Dashboard 查看今日班次与打卡窗口

---

## 8. 数据模型

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `shift_templates` | 班次模板 | name, color, start_time, end_time, remind_before_min, remind_after_min, overtime_min, is_rest |
| `schedules` | 每日排班 | date, shift_template_id |
| `push_logs` | 推送与运行日志 | timestamp, log_type, channel, result, level, detail |
| `system_configs` | 系统配置键值对 | key, value |

---

## 9. 后期优化方向

### 9.1 功能增强

- **多用户/多设备管理**：支持为不同人员维护独立排班和提醒配置。
- **节假日自动识别**：接入法定节假日 API，自动将节假日设为休息。
- **排班模板/周期排班**：支持「做五休二」「轮班制」等规则批量生成排班。
- **排班导入导出**：除 JSON 外支持 Excel/CSV 导入导出。
- **提醒内容自定义**：允许配置上下班推送文案、@人员。
- **推送渠道扩展**：
  - 企业微信
  - 钉钉群机器人
  - Bark / Pushover / Server 酱
  - 邮件 SMTP（字段已预留，逻辑待实现）
  - 短信（字段已预留，逻辑待实现）
- **移动端适配**：当前 Ant Design 桌面布局为主，后续优化移动端体验。

### 9.2 稳定性与运维

- **日志自动清理**：已预留 `log_retention_days` 配置，但清理任务尚未实现。
- **数据库迁移**：当前使用 SQLAlchemy `create_all()`，后续可引入 Alembic 管理 Schema 变更。
- **健康检查与监控**：为容器添加 `/health` 端点，接入 Prometheus/ Grafana。
- **备份机制**：定时备份 SQLite 数据库和配置。
- **配置热重载**：部分配置修改后需要重启后端，可改为运行时读取。

### 9.3 安全

- **配置加密**：webhook、API Key 等敏感字段不以明文存储或展示。
- **登录认证**：当前无鉴权，若暴露到公网需增加登录/Token 机制。
- **HTTPS**：生产环境建议通过反向代理（Nginx/Traefik）启用 HTTPS。

### 9.4 工程化

- **测试覆盖**：补充单元测试与接口测试。
- **类型安全**：前端已用 TypeScript，后端可补充 Pydantic 校验细节。
- **代码分层**：将 `engine.py` 中数据库操作与业务逻辑进一步拆分。
- **CI/CD 优化**：增加镜像安全扫描、版本号管理、发布说明自动生成。

---

## 10. 还需要添加的功能

根据当前实现与原始需求差距，建议优先完成以下事项：

| 优先级 | 功能 | 说明 |
|--------|------|------|
| 高 | 日志自动清理 | 根据 `log_retention_days` 每天删除过期 `push_logs` 记录，避免数据库无限增长。 |
| 高 | 邮件/短信通知实现 | `Settings.tsx` 与 `config.py` 已预留字段，但 `services/push.py` 尚未实现发送逻辑。 |
| 中 | 手动触发打卡检查 | 在 Dashboard 或 Settings 增加「立即检查」按钮，方便调试。 |
| 中 | 推送测试按钮 | 在系统设置中增加「测试飞书推送」「测试 fwalert 推送」，验证配置是否正确。 |
| 中 | 批量排班 | 支持框选一段日期批量设置班次，减少逐日点击。 |
| 中 | 操作确认与撤销 | 删除班次、覆盖排班时增加二次确认，重要操作支持撤销。 |
| 低 | 深色模式 | Ant Design 支持主题切换。 |
| 低 | 多语言 | 当前为中文，后续可支持英文。 |
| 低 | API 文档自动展示 | FastAPI 已自动生成 `/docs`，可 front 端增加链接。 |

---

## 11. 常见问题

### 11.1 部署后无法发送提醒

排查步骤：

1. 查看「推送日志」页面，筛选 `level=error` 的记录。
2. 确认「系统设置」中 API Key、DST ID、webhook 已填写。
3. 确认今日有排班且不是休息类型。
4. 确认当前时间处于打卡窗口内。
5. 查看 Dashboard 上的云端打卡状态是否返回正确值。
6. 检查容器时区是否为 `Asia/Shanghai`（已在 Dockerfile 中设置）。

### 11.2 端口 80 被占用

修改 `docker-compose.yml` 中 frontend 的端口映射，例如：

```yaml
ports:
  - "8080:80"
```

### 11.3 `config.json` 挂载报错

确保宿主机上的 `config.json` 是普通文件而非目录。若之前被错误创建为目录，删除后重新创建文件：

```bash
rm -rf /path/to/config.json
touch /path/to/config.json
```

---

## 12. 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite 5 + Ant Design 5 + React Router 6 + Axios |
| 后端 | Python 3.11 + FastAPI + SQLAlchemy 2 + SQLite + APScheduler + Loguru |
| 容器 | Docker + Docker Compose + Nginx |
| CI/CD | GitHub Actions + GitHub Container Registry |

---

*文档最后更新：2026-09-03*
