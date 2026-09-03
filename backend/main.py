from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base, SessionLocal
from routers import dashboard, shifts, schedule, logs, config, import_data, skip
from scheduler import start_scheduler, scheduler
from seed import seed_data
from migrations import run_migrations


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 只在进程启动时执行一次：建表、迁移、初始化数据、启动 scheduler
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    seed_data()
    start_scheduler()
    yield
    # 关闭时停止 scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown()


app = FastAPI(title="钉钉打卡提醒系统 Web API", lifespan=lifespan)

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


@app.get("/health")
def health_check():
    db = None
    db_ok = False
    try:
        db = SessionLocal()
        db.execute(Base.metadata.tables["system_configs"].select().limit(1))
        db_ok = True
    except Exception:
        db_ok = False
    finally:
        if db:
            db.close()

    scheduler_running = scheduler is not None and scheduler.running

    return {
        "status": "healthy" if db_ok and scheduler_running else "unhealthy",
        "timestamp": datetime.now().isoformat(),
        "database": "ok" if db_ok else "error",
        "scheduler": "running" if scheduler_running else "stopped",
    }
