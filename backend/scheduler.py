from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger

scheduler = None


def start_scheduler():
    global scheduler
    if scheduler is not None:
        return

    from engine import run_check
    from tasks import cleanup_logs, backup_data

    scheduler = BackgroundScheduler()
    scheduler.add_job(
        run_check,
        trigger=CronTrigger(minute="*"),
        id="check_attendance",
        replace_existing=True,
    )
    scheduler.add_job(
        cleanup_logs,
        trigger=CronTrigger(hour=3, minute=0),
        id="cleanup_logs",
        replace_existing=True,
    )
    scheduler.add_job(
        backup_data,
        trigger=CronTrigger(hour=3, minute=30),
        id="backup_data",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("定时任务已启动：每分钟检查打卡，每天 03:00 清理日志，03:30 备份数据")
