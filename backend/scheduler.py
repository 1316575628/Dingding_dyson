from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger

scheduler = None


def start_scheduler():
    global scheduler
    if scheduler is not None:
        return

    from engine import run_check

    scheduler = BackgroundScheduler()
    scheduler.add_job(
        run_check,
        trigger=CronTrigger(minute="*"),
        id="check_attendance",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("定时任务已启动，每分钟检查一次")
