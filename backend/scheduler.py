import os
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from filelock import FileLock, Timeout
from loguru import logger

scheduler = None
_scheduler_lock = None
SCHEDULER_LOCK_FILE = Path(os.getenv("DATA_DIR", "/data")) / ".scheduler.lock"


def start_scheduler():
    """启动定时任务，使用文件锁保证多 worker/多进程下只有一个实例运行。"""
    global scheduler, _scheduler_lock
    if scheduler is not None:
        return

    SCHEDULER_LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    _scheduler_lock = FileLock(str(SCHEDULER_LOCK_FILE), timeout=0)
    try:
        _scheduler_lock.acquire()
    except Timeout:
        logger.info("其他 worker 已持有 scheduler 锁，本进程不启动定时任务")
        _scheduler_lock = None
        return

    from engine import run_check
    from tasks import cleanup_logs, backup_data

    scheduler = BackgroundScheduler()
    scheduler.add_job(
        run_check,
        trigger=CronTrigger(minute="*"),
        id="check_attendance",
        replace_existing=True,
        misfire_grace_time=30,
        max_instances=1,
    )
    scheduler.add_job(
        cleanup_logs,
        trigger=CronTrigger(hour=3, minute=0),
        id="cleanup_logs",
        replace_existing=True,
        misfire_grace_time=300,
        max_instances=1,
    )
    scheduler.add_job(
        backup_data,
        trigger=CronTrigger(hour=3, minute=30),
        id="backup_data",
        replace_existing=True,
        misfire_grace_time=300,
        max_instances=1,
    )
    scheduler.start()
    logger.info("定时任务已启动：每分钟检查打卡，每天 03:00 清理日志，03:30 备份数据")


def stop_scheduler():
    """关闭定时任务并释放文件锁。"""
    global scheduler, _scheduler_lock
    if scheduler is not None and scheduler.running:
        scheduler.shutdown()
        scheduler = None
    if _scheduler_lock is not None:
        try:
            _scheduler_lock.release()
        except Exception:
            pass
        _scheduler_lock = None
