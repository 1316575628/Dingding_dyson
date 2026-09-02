

# 钉钉打卡提醒系统 Web 版 — 产品需求文档 (PRD)

> 版本：v2.0 | 日期：2026-07-25 | 状态：开发中

---

## 1. 项目背景

### 1.1 现状

当前运行一套 Python 脚本（`dingding_TX.py`），通过 crontab 定时执行，实现以下功能：

- 读取 `data.json` 排班表，匹配当日班次（A班 / P班）
- 在上班前 15 分钟、下班后 30 分钟内触发打卡提醒窗口
- 调用维格表 API 查询云端打卡状态，避免重复推送
- 通过飞书 webhook + fwalert webhook 双通道推送提醒
- 将云端打卡状态回写 `config.json`
- loguru 日志按天轮转，保留 7 天

### 1.2 痛点

| 痛点 | 描述 |
|------|------|
| 排班维护困难 | 手写三层嵌套 JSON，易出错、不直观 |
| 班次硬编码 | A/P 两种班次时间写死，无法灵活扩展 |
| 配置修改门槛高 | 需要 SSH 进服务器改 JSON 文件 |
| 日志查看不便 | 需要登录服务器 `tail -f` 看日志 |
| 状态不透明 | 不知道今天什么班、是否已推送、云端状态如何 |
| 部署依赖环境 | Python 环境、依赖安装、crontab 配置 |

---

## 2. 产品目标

将 Python 脚本升级为一套 **Web 前后端系统**，Docker 一键部署在 NAS（192.168.10.6）上，提供：

1. **可视化排班日历** — 点击切换班次，告别手写 JSON
2. **自定义多班次管理** — 不限班次数量，每种独立配置上下班时间、提醒窗口
3. **实时 Dashboard** — 今日班次、打卡窗口状态、云端状态一览
4. **日志中心** — 分页筛选、搜索、自动清理
5. **Web UI 配置** — 所有参数在页面上修改，即时生效
6. **数据导入** — 支持现有 `data.json` 一键导入，后续也支持 JSON 上传

---

## 3. 功能模块详述

### 3.1 Dashboard（首页仪表盘）

**页面路径**：`/dashboard`

**功能**：

- 显示今日日期
- 显示今日班次名称（带颜色标签），无排班时显示「休息」
- 显示上班/下班时间
- 实时展示当前是否在「上班打卡窗口」或「下班打卡窗口」
- 显示云端打卡状态（维格表返回的「上班未打卡 / 已打卡」等）
- 每 30 秒自动刷新

**UI 布局**：

```
┌─────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ 今日班次  │  │ 上班窗口  │  │ 下班窗口  │     │
│  │   A班    │  │  进行中   │  │  未开启   │     │
│  └──────────┘  └──────────┘  └──────────┘     │
│                                                 │
│  详细信息                                       │
│  ┌─────────────────────────────────────────┐   │
│  │ 日期：2026-07-25                         │   │
│  │ 班次：A班   上班：09:00  下班：18:00      │   │
│  │ 上班状态(云端)：上班未打卡                │   │
│  │ 下班状态(云端)：下班未打卡                │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

### 3.2 班次管理

**页面路径**：`/shifts`

**功能**：

- 表格展示所有班次模板
- 新建班次（弹窗表单）
- 编辑班次
- 删除班次（二次确认）

**班次字段**：

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| 名称 | 文本 | 班次唯一标识 | A班、P班、晚班、C班 |
| 颜色 | 颜色选择器 | 日历上显示的标记颜色 | #1890ff |
| 上班时间 | 时间选择器 | 上班打卡时间 | 09:00 |
| 下班时间 | 时间选择器 | 下班打卡时间 | 18:00 |
| 上班提醒提前量 | 数字（分钟） | 提前多久开始推送上班提醒 | 15 |
| 下班提醒延后量 | 数字（分钟） | 下班后多久内还推送提醒 | 30 |
| 加班时长 | 数字（分钟） | 下班时间往后延多久仍算打卡窗口 | 0 |
| 休息类型 | 开关 | 开启后该班次不触发任何提醒 | false |

**说明**：
- 「休息类型」用于标记「年假」「调休」「病假」等特殊状态，勾选后该班次等同于休息日，定时器不会触发打卡检查
- 颜色用于排班日历上的视觉区分

---

### 3.3 排班日历

**页面路径**：`/schedule`

**功能**：

- 月视图日历，每个日期格内显示当日班次名称 + 对应颜色标记
- 无排班的日期留空（不上色、不显示文字）
- 点击任意日期弹出班次选择器，可修改该日排班
- 支持月份切换（上/下月箭头）

**交互流程**：

```
点击日期 → 弹窗出现 → 下拉选择班次 → 确认 → 日历刷新
```

**数据存储**：

- 排班按「日期 → 班次模板 ID」存储在 SQLite 中
- 与原有 `data.json` 完全解耦，不再需要手动维护 JSON

---

### 3.4 打卡提醒引擎

**运行方式**：后端 APScheduler 定时任务，每分钟执行一次

**执行流程**（与 Python 脚本逻辑一致）：

```
1. 查询今日排班 → 无排班或休息 → 跳过
                 ↓
2. 判断当前时间是否在打卡窗口
   - 上班窗口：start - remind_before_min ≤ now < start
   - 下班窗口：end + overtime < now ≤ end + overtime + remind_after
                 ↓
3. 在窗口内 → 检查本地记录（clockInDetection / clockOutDetection）
   - 本地已标记「已打卡」 → 跳过（今天已经打过卡了）
   - 本地标记「未打卡」 → 查维格表云端状态
                 ↓
4. 云端也显示「未打卡」 → 双通道推送提醒
   - 飞书 webhook
   - fwalert webhook
                 ↓
5. 将云端结果回写到本地系统配置
```

**关键点**：
- 本地状态记录的作用是避免同一窗口内重复推送（比如 8:45-9:00 这 15 分钟窗口里每分钟都查一次，但只推一次）
- 两个通道独立推送，失败互不影响
- 每次推送结果写入日志表

---

### 3.5 推送日志

**页面路径**：`/logs`

**功能**：

- 分页表格展示所有推送记录
- 筛选条件：类型（上班提醒 / 下班提醒）、结果（成功 / 失败）、日期范围
- 关键词搜索（匹配详情字段）
- 每页 20 条，显示总条数

**日志字段**：

| 字段 | 说明 |
|------|------|
| 时间 | 推送发生的精确时间 |
| 类型 | 上班提醒 / 下班提醒 / 系统 |
| 渠道 | 飞书 / fwalert |
| 结果 | 成功 / 失败 |
| 详情 | 失败时的错误信息，成功时为空 |

**日志保留**：可在系统设置中配置保留天数，定时清理过期日志

---

### 3.6 系统设置

**页面路径**：`/settings`

**第一部分：核心配置**

| 配置项 | 说明 | 示例值 |
|--------|------|--------|
| 维格表 API Key | vika.cn 的 API 密钥 | uskQKE43P37... |
| 维格表 DST ID | 数据表 ID | dstMBfWtvKa... |
| 飞书 Webhook | 飞书机器人 webhook 地址 | https://open.feishu.cn/... |
| fwalert Webhook | fwalert 推送地址 | https://fwalert.com/... |
| 日志保留天数 | 超过天数自动清理 | 7 |

**第二部分：数据导入**

- 上传按钮，支持 `.json` 文件
- 导入格式：与原 `data.json` 完全一致（年 > 月 > 日 > 班次名）
- 导入时自动创建不存在的班次模板（默认时间 09:00-18:00，颜色默认蓝）
- 导入覆盖已有日期的排班

---

## 4. 技术方案

### 4.1 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 前端框架 | React 18 + TypeScript | 组件化开发，类型安全 |
| UI 组件库 | Ant Design 5 | 日历/表格/表单/弹窗组件成熟 |
| 构建工具 | Vite 5 | 快速冷启动，HMR 热更新 |
| 路由 | React Router 6 | SPA 路由 |
| HTTP 客户端 | Axios | 请求拦截、超时控制 |
| 后端框架 | FastAPI (Python) | 异步高性能，自动生成 API 文档，复用原有逻辑 |
| ORM | SQLAlchemy 2 | Python 生态最成熟的 ORM |
| 数据库 | SQLite | 零依赖，NAS 友好，数据量小 |
| 定时任务 | APScheduler | FastAPI 原生集成，支持 cron 表达式 |
| 容器化 | Docker + docker-compose | 一键部署，环境隔离 |

### 4.2 项目结构

```
dingding-web/
├── docker-compose.yml          # 编排文件
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                 # FastAPI 入口
│   ├── database.py             # SQLite + SQLAlchemy
│   ├── models.py               # 数据模型
│   ├── engine.py               # 打卡引擎核心逻辑
│   ├── scheduler.py            # APScheduler 定时任务
│   └── routers/
│       ├── __init__.py
│       ├── dashboard.py        # /api/dashboard
│       ├── shifts.py           # /api/shifts（班次 CRUD）
│       ├── schedule.py         # /api/schedule（排班日历）
│       ├── logs.py             # /api/logs（推送日志）
│       ├── config.py           # /api/config（系统配置）
│       └── import_data.py      # /api/import（数据导入）
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf              # Nginx 配置（反向代理 API + 静态文件）
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── index.tsx
│       ├── index.css
│       ├── App.tsx             # 路由配置
│       ├── api/index.ts        # Axios 实例
│       ├── components/
│       │   └── Layout.tsx      # 侧边栏 + 顶栏布局
│       └── pages/
│           ├── Dashboard.tsx
│           ├── Shifts.tsx
│           ├── Schedule.tsx
│           ├── Logs.tsx
│           └── Settings.tsx
```

### 4.3 数据模型

```
shift_template（班次模板）
├── id              INTEGER PK
├── name            TEXT    (唯一，如 "A班")
├── color           TEXT    (Hex 颜色)
├── start_time      TIME    (上班时间)
├── end_time        TIME    (下班时间)
├── remind_before_min INTEGER (上班提醒提前分钟数)
├── remind_after_min  INTEGER (下班提醒延后分钟数)
├── overtime_min    INTEGER (加班分钟数)
└── is_rest         BOOLEAN (是否休息类型)

schedule（每日排班）
├── id              INTEGER PK
├── date            DATE    (唯一)
└── shift_template_id INTEGER FK → shift_template.id

push_log（推送日志）
├── id              INTEGER PK
├── timestamp       DATETIME
├── log_type        TEXT    (work / worked / system)
├── channel         TEXT    (feishu / fwalert)
├── result          TEXT    (success / fail)
└── detail          TEXT    (错误信息)

system_config（系统配置，键值对）
├── id              INTEGER PK
├── key             TEXT    (唯一)
└── value           TEXT
```

### 4.4 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dashboard` | 获取今日状态总览 |
| GET | `/api/shifts` | 班次列表 |
| POST | `/api/shifts` | 新建班次 |
| PUT | `/api/shifts/:id` | 编辑班次 |
| DELETE | `/api/shifts/:id` | 删除班次 |
| GET | `/api/schedule?year=&month=` | 获取某月排班 |
| POST | `/api/schedule/set` | 设置某日排班 |
| GET | `/api/schedule/range?start=&end=` | 获取日期范围排班 |
| GET | `/api/logs` | 分页查询日志（支持筛选） |
| GET | `/api/logs/stats` | 日志统计 |
| GET | `/api/config` | 获取所有配置 |
| POST | `/api/config` | 保存配置 |
| POST | `/api/import/schedule-json` | 导入排班 JSON 文件 |

### 4.5 部署架构

```
┌──────────────────────────────────────────┐
│  NAS (192.168.10.6)                      │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  docker-compose                    │  │
│  │                                    │  │
│  │  ┌──────────┐    ┌──────────────┐  │  │
│  │  │ frontend  │───→│   backend    │  │  │
│  │  │ (nginx)  │    │  (FastAPI)   │  │  │
│  │  │  :80     │    │   :8000      │  │  │
│  │  └──────────┘    │              │  │  │
│  │                  │  APScheduler │  │  │
│  │                  │  (每分钟检查) │  │  │
│  │                  │              │  │  │
│  │                  │  SQLite      │  │  │
│  │                  │  (/data/)    │  │  │
│  │                  └──────────────┘  │  │
│  │                                    │  │
│  │  Volume: dingding_data → /data    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  浏览器访问: http://192.168.10.6         │
└──────────────────────────────────────────┘
```

- **前端**：Nginx 提供静态文件，`/api/` 路径反向代理到后端
- **后端**：FastAPI + APScheduler，SQLite 持久化存储在 Docker Volume
- **网络**：前端 80 端口、后端 8000 端口均映射到宿主机

---

## 5. 部署方式

### 5.1 首次部署

```bash
# 1. 将项目上传到 NAS
scp -r dingding-web root@192.168.10.6:/opt/

# 2. SSH 登录 NAS
ssh root@192.168.10.6

# 3. 进入项目目录
cd /opt/dingding-web

# 4. 启动服务
docker-compose up -d --build

# 5. 浏览器访问
http://192.168.10.6
```

### 5.2 首次配置流程

1. 访问 `http://192.168.10.6/settings`
2. 填入维格表 API Key、DST ID、飞书/fwalert webhook
3. 进入「班次管理」创建 A班、P班等班次模板（或直接导入 JSON 自动创建）
4. 进入「系统设置」→ 上传现有 `data.json` 一键导入历史排班
5. 检查 Dashboard 是否正确显示今日班次

### 5.3 后续维护

- 排班变更：在「排班日历」页面点击日期修改
- 新增班次类型：在「班次管理」页面创建
- 查看推送记录：在「推送日志」页面筛选查看
- 修改 webhook：在「系统设置」页面修改后保存

---

## 6. 与原 Python 脚本对比

| 功能 | Python 版 | Web 版 |
|------|-----------|--------|
| 班次管理 | 硬编码 A→09-18，其他→13-22 | 不限数量，每个独立配置 |
| 排班维护 | 手写 data.json | 日历点击可视化编辑 |
| 配置修改 | SSH 改 config.json | Web 表单 |
| 日志查看 | tail -f 文件 | 分页筛选搜索 |
| 状态查看 | 无 | Dashboard 实时展示 |
| 数据导入 | 无 | JSON 上传导入 |
| 部署 | Python + crontab | Docker 一键 |
| 年假/调休 | 被当作 B 班处理 | 设为休息类型，跳过提醒 |

---

## 7. 开发状态

- [x] 需求分析与定稿
- [x] 技术方案设计
- [x] 后端代码（FastAPI + SQLAlchemy + APScheduler）
- [x] 前端代码（React + Ant Design + Vite）
- [x] Docker 配置（docker-compose + Dockerfile × 2 + nginx.conf）
- [ ] 部署到 NAS（192.168.10.6）
- [ ] 导入历史 data.json
- [ ] 功能验证与调试

---

## 8. 附录

### 8.1 维格表 API 说明

后端通过维格表 Fusion API 查询打卡记录：

```
GET https://api.vika.cn/fusion/v1/datasheets/{DST_ID}/records?pageSize=2
Header: Authorization: Bearer {API_KEY}
```

返回的 records 数组：
- `records[0]` — 上班打卡记录，`fields.打卡检测` 字段为 `上班未打卡` 或 `上班已打卡`
- `records[1]` — 下班打卡记录，`fields.打卡检测` 字段为 `下班未打卡` 或 `下班已打卡`

### 8.2 班次时间窗口计算规则

以 A 班为例（09:00-18:00，提前 15 分钟，延后 30 分钟，加班 0 分钟）：

```
上班窗口：08:45 ≤ 当前时间 < 09:00
下班窗口：18:00 < 当前时间 ≤ 18:30
```

以带加班的班次为例（09:00-18:00，提前 15 分钟，延后 30 分钟，加班 60 分钟）：

```
上班窗口：08:45 ≤ 当前时间 < 09:00
下班窗口：19:00 < 当前时间 ≤ 19:30
```

### 8.3 data.json 格式示例

```json
{
  "2026": {
    "7": {
      "25": "A",
      "26": "休",
      "27": "P"
    }
  }
}
```

导入规则：
- 班次名与已有模板匹配 → 直接关联
- 班次名不存在 → 自动创建模板（默认时间 09:00-18:00，蓝色）
- "休" → 自动创建休息类型模板（灰色）
*（内容由AI生成，仅供参考）*
