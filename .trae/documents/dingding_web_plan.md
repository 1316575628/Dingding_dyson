# 钉钉打卡提醒系统 Web 版 — 产品实施计划

> 生成日期：2026-09-03 | 状态：待用户确认

---

## 1. 项目摘要（Summary）

将当前单文件 Python 脚本 `dingding_TX.py` 升级为一套 **个人自用的 Web 版打卡提醒系统**，部署在 NAS（192.168.10.6）上。

**核心目标**：
- 保留 Python 脚本全部功能（排班识别、打卡窗口计算、维格表查询、双通道推送、状态回写）
- 通过可视化界面替代手写 `data.json` 和 SSH 改配置
- 在 Dashboard 实时展示今日班次、窗口状态、云端打卡状态
- 提供推送日志的可视化查询与自动清理
- 支持历史 `data.json` 一键导入

**本次范围（MVP）**：
- 单用户、无需登录
- 桌面浏览器为主，兼顾基础响应式
- 通知渠道：复刻飞书 + fwalert 双 webhook，预留浏览器桌面通知接口但本次不强制实现
- 邮件/短信作为二期扩展，本期仅预留配置字段
- 新增"今日跳过"人工干预按钮

---

## 2. 当前现状分析（Current State Analysis）

### 2.1 已有资产

| 文件 | 说明 | 价值 |
|------|------|------|
| `dingding_TX.py` | 完整运行逻辑 | 可直接翻译为后端打卡引擎 |
| `config.json` | 维格表凭证 + webhook + 本地状态 | 迁移为数据库 system_config |
| `data.json` | 年-月-日三层排班 | 导入为 schedule 表 + shift_template 表 |
| `PRD_钉钉打卡提醒系统Web版.md` | 已产出详细需求文档 | 作为产品功能基线 |

### 2.2 当前痛点（已验证）

1. **排班维护困难**：`data.json` 三层嵌套，手动编辑易出错
2. **班次硬编码**：A/P 两班时间写死在脚本里
3. **配置修改门槛高**：必须 SSH 登录服务器改 JSON
4. **日志查看不便**：只能 `tail -f` 本地日志文件
5. **状态不透明**：用户无法一眼看到今天什么班、是否已经推送
6. **缺少人工干预**：今天临时请假/调休只能临时改排班，不能一键跳过

### 2.3 技术约束

- 目标部署环境：NAS `192.168.10.6`，Docker 部署
- 数据库选型：SQLite（零依赖、NAS 友好、数据量小）
- 后端：Python FastAPI（复用现有逻辑成本最低）
- 前端：React + TypeScript + Ant Design + Vite
- 定时任务：APScheduler 每分钟执行一次

---

## 3. 产品需求澄清与决策（Product Decisions）

基于与用户的两轮沟通，最终决策如下：

| 议题 | 决策 | 说明 |
|------|------|------|
| 使用范围 | 仅个人使用 | 不实现登录、权限、多用户 |
| 主要访问设备 | 电脑浏览器 | UI 以桌面端优先，保留基础响应式 |
| 通知渠道（本期） | 飞书 webhook + fwalert webhook | 复刻 Python 脚本双通道 |
| 浏览器桌面通知 | 预留接口，本期不强求 | 受 HTTPS/localhost 限制，NAS 内网可能不生效 |
| 邮件/短信 | 二期扩展 | 本期只在设置页预留空字段，不实现发送逻辑 |
| 人工干预 | 需要"今日跳过" | Dashboard 增加按钮，今日不再推送 |
| 脏数据导入 | 自动忽略异常值 | 只识别合法班次名，"25/4/9" 这类数据跳过 |
| 年假/调休 | 通过"休息类型"班次处理 | 与 PRD 保持一致 |

### 3.1 额外挖掘出的需求

1. **一键跳过今日提醒**：用户明确需要，用于临时请假/外出等场景。
2. **导入历史排班**：已有 2023 年 11-12 月数据，需要平滑迁移。
3. **日志可搜索/筛选**：用户提到"日志也要显示"，隐含需要按时间/类型/结果查询。
4. **班次颜色标记**：日历上通过颜色快速识别不同班次。
5. **实时状态感知**：Dashboard 需要让用户一眼看到"今天打没打卡、窗口开没开"。

---

## 4. 实施计划（Proposed Changes）

### 4.1 后端部分（`backend/`）

#### 4.1.1 项目骨架

**新增文件**：
- `backend/requirements.txt`
- `backend/Dockerfile`
- `backend/main.py` — FastAPI 入口、CORS、路由挂载
- `backend/database.py` — SQLite + SQLAlchemy 2 会话管理
- `backend/models.py` — 四个数据模型

**数据模型**：

```text
ShiftTemplate（班次模板）
├── id: int PK
├── name: str unique          # A班 / P班 / 休
├── color: str                # Hex 颜色
├── start_time: time          # 上班时间
├── end_time: time            # 下班时间
├── remind_before_min: int    # 上班提前提醒分钟数
├── remind_after_min: int     # 下班延后提醒分钟数
├── overtime_min: int         # 加班分钟数
└── is_rest: bool             # 是否休息类型

Schedule（每日排班）
├── id: int PK
├── date: date unique
└── shift_template_id: int FK

PushLog（推送日志）
├── id: int PK
├── timestamp: datetime
├── log_type: str             # work / worked / system
├── channel: str              # feishu / fwalert
├── result: str               # success / fail
└── detail: str               # 失败原因

SystemConfig（系统配置）
├── id: int PK
├── key: str unique
└── value: str
```

#### 4.1.2 业务路由

**新增文件**：
- `backend/routers/__init__.py`
- `backend/routers/dashboard.py` — 今日状态总览
- `backend/routers/shifts.py` — 班次 CRUD
- `backend/routers/schedule.py` — 排班日历读写
- `backend/routers/logs.py` — 推送日志查询
- `backend/routers/config.py` — 系统配置 CRUD
- `backend/routers/import_data.py` — data.json 导入
- `backend/routers/skip.py` — 今日跳过开关

**关键接口**：

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/dashboard` | 今日班次、窗口状态、云端状态 |
| GET/POST/PUT/DELETE | `/api/shifts` | 班次管理 |
| GET/POST | `/api/schedule` | 月排班查询与单日设置 |
| GET | `/api/logs` | 分页筛选推送日志 |
| GET/POST | `/api/config` | 系统配置读写 |
| POST | `/api/import/schedule-json` | 上传 data.json 导入 |
| POST | `/api/skip/today` | 今日跳过 |

#### 4.1.3 打卡引擎与定时任务

**新增文件**：
- `backend/engine.py` — 打卡核心逻辑（由 `dingding_TX.py` 翻译）
- `backend/scheduler.py` — APScheduler 每分钟调度

**逻辑要点**：
1. 读取今日排班；无排班或休息则跳过。
2. 计算上班窗口：`start_time - remind_before_min` 到 `start_time`
3. 计算下班窗口：`end_time + overtime_min` 到 `end_time + overtime_min + remind_after_min`
4. 窗口内且本地状态为"未打卡"时查询维格表。
5. 云端也显示"未打卡"时，调用 `push()` 双通道推送。
6. 推送结果写入 `PushLog`。
7. 将云端状态回写到 `SystemConfig`。
8. 如果用户点击了"今日跳过"，当日不再触发任何推送。

#### 4.1.4 推送服务

**新增文件**：
- `backend/services/push.py`

**实现**：
- `push_feishu(msg)`：POST 飞书 webhook
- `push_fwalert(msg)`：拼接 URL 后 POST
- 两个通道独立，失败互不影响
- 结果统一写入 `PushLog`

#### 4.1.5 初始化数据

**新增文件**：
- `backend/seed.py`

**初始化内容**：
- 默认班次模板：A班（09:00-18:00，蓝色）、P班（13:00-22:00，绿色）、休息（灰色）
- 从 `config.json` 自动读取核心配置并写入 `SystemConfig`
- 服务启动时执行，避免首次使用空数据

---

### 4.2 前端部分（`frontend/`）

#### 4.2.1 项目骨架

**新增文件**：
- `frontend/package.json`
- `frontend/vite.config.ts`
- `frontend/tsconfig.json`
- `frontend/index.html`
- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/index.css`

**依赖**：
- React 18 + TypeScript
- Ant Design 5
- React Router 6
- Axios
- Day.js（日期处理）

#### 4.2.2 路由与布局

**新增文件**：
- `frontend/src/components/Layout.tsx` — 侧边栏 + 顶栏
- `frontend/src/api/index.ts` — Axios 实例

**路由**：
- `/dashboard` — 首页仪表盘
- `/shifts` — 班次管理
- `/schedule` — 排班日历
- `/logs` — 推送日志
- `/settings` — 系统设置

#### 4.2.3 页面实现

**新增文件**：
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/Shifts.tsx`
- `frontend/src/pages/Schedule.tsx`
- `frontend/src/pages/Logs.tsx`
- `frontend/src/pages/Settings.tsx`

**各页面要点**：

| 页面 | 核心功能 |
|------|---------|
| Dashboard | 今日日期、班次卡片、窗口状态、云端状态、30秒自动刷新、今日跳过按钮 |
| Shifts | 班次表格、新建/编辑弹窗、颜色选择器、删除确认 |
| Schedule | Ant Design Calendar 月视图、点击日期弹窗选班次、上下月切换 |
| Logs | 分页表格、类型/结果/日期筛选、关键词搜索 |
| Settings | 维格表 API Key / DST ID、双 webhook、日志保留天数、JSON 导入 |

---

### 4.3 部署部分（根目录）

**新增文件**：
- `docker-compose.yml`
- `.dockerignore`（可选）

**架构**：
- `frontend` 服务：Nginx，暴露 80 端口，提供静态文件并反向代理 `/api/*` 到后端
- `backend` 服务：FastAPI，暴露 8000 端口
- `dingding_data` Docker Volume：挂载到 `/data`，持久化 SQLite 数据库

---

### 4.4 数据迁移

**新增文件**：
- `backend/scripts/import_legacy.py` — 一次性导入脚本

**导入规则**：
1. 读取 `/workspace/data.json`
2. 遍历年 → 月 → 日
3. 班次名已存在则关联；不存在则自动创建默认模板（09:00-18:00，蓝色）
4. "休" 关联到休息模板
5. 异常值（如 "25/4/9"）自动跳过并记录日志

---

## 5. 假设与风险（Assumptions & Risks）

### 5.1 假设

- NAS 已安装 Docker 与 docker-compose
- 用户已持有维格表 API Key、DST ID、飞书与 fwalert webhook
- 用户希望保留现有 `data.json` 中的历史排班记录
- 飞书 webhook 和 fwalert webhook 与 Python 脚本完全一致，可直接复用

### 5.2 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 维格表 API 调用频率限制 | 每分钟一次的 APScheduler 可能触发限流 | 在窗口内才查询，非窗口不查；本地状态缓存 |
| NAS 内网无法使用浏览器桌面通知 | 该功能受限 | 本期不强求，仅预留接口 |
| 用户没有 HTTPS 域名 | 浏览器通知、部分安全策略受限 | 以内网 HTTP 为主 |
| 原 `data.json` 脏数据 | 导入异常 | 自动跳过并提示 |

---

## 6. 验证步骤（Verification Steps）

### 6.1 本地开发验证

1. 启动后端：`cd backend && uvicorn main:app --reload`
2. 启动前端：`cd frontend && npm run dev`
3. 访问 `http://localhost:5173`
4. 检查 Dashboard 是否显示今日班次
5. 在 Settings 页面填入 config.json 中的配置
6. 在 Shifts 页面确认 A班/P班/休息已预置
7. 在 Schedule 页面点击日期切换班次，确认刷新后保留
8. 上传 `data.json`，检查 Schedule 页面是否出现历史排班
9. 在 Logs 页面能看到导入/系统日志

### 6.2 Docker 部署验证

1. 在 NAS 上运行 `docker-compose up -d --build`
2. 访问 `http://192.168.10.6`
3. 确认前端页面正常加载
4. 确认 `/api/dashboard` 返回正确 JSON
5. 确认 SQLite 数据持久化在 Volume 中
6. 等待到打卡窗口时间，观察是否触发推送并记录日志

### 6.3 功能一致性验证

| 原 Python 功能 | Web 版对应验证 |
|----------------|----------------|
| 读取 data.json | Schedule 日历显示正确 |
| A班/P班时间 | Shifts 页面时间正确 |
| 上班窗口判断 | Dashboard 状态正确 |
| 下班窗口判断 | Dashboard 状态正确 |
| 维格表查询 | Settings 配置后 Dashboard 显示云端状态 |
| 双通道推送 | Logs 页面看到 feishu / fwalert 成功记录 |
| 状态回写 | 推送后 Dashboard 不再重复提醒 |
| 日志记录 | Logs 页面可查询 |

---

## 7. 后续可扩展项（Out of Scope for MVP）

以下功能已记录但不纳入本期实施：

1. **邮件/短信通知**：需要 SMTP 或短信平台配置
2. **浏览器桌面通知**：受部署环境限制
3. **多用户/登录体系**：当前仅个人使用
4. **移动端 PWA**：当前以电脑浏览器为主
5. **统计报表**：月度打卡统计、迟到分析等
6. **自动备份**：数据库定时导出

---

## 8. 总结

本期将交付一个**功能完整、部署简单、仅个人使用**的钉钉打卡提醒 Web 系统。核心交付物包括：

- 可视化排班日历（替代 data.json）
- 班次管理（替代硬编码 A/P 班）
- Dashboard 实时状态（替代 tail 日志猜状态）
- 推送日志中心
- Web 配置页面
- 历史数据导入
- "今日跳过"人工干预
- Docker 一键部署

确认本计划后，将按"后端模型与配置 → 后端 API 与引擎 → 前端页面 → Docker 部署 → 数据导入 → 联调验证"的顺序实施。
