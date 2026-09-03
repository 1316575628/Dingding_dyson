from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import dashboard, shifts, schedule, logs, config, import_data, skip
from scheduler import start_scheduler
from seed import seed_data
from migrations import run_migrations

app = FastAPI(title="钉钉打卡提醒系统 Web API")

origins = [
    "http://localhost",
    "http://localhost:5173",
    "http://127.0.0.1",
    "http://127.0.0.1:5173",
    "http://192.168.10.6",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 创建数据库表
Base.metadata.create_all(bind=engine)

# 自动迁移：补齐新增字段
run_migrations(engine)

# 初始化默认数据
seed_data()

# 启动定时任务
start_scheduler()

# 注册路由
app.include_router(dashboard.router, prefix="/api")
app.include_router(shifts.router, prefix="/api")
app.include_router(schedule.router, prefix="/api")
app.include_router(logs.router, prefix="/api")
app.include_router(config.router, prefix="/api")
app.include_router(import_data.router, prefix="/api")
app.include_router(skip.router, prefix="/api")


@app.get("/")
def read_root():
    return {"message": "钉钉打卡提醒系统 Web API"}
