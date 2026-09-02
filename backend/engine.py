from datetime import datetime, date, timedelta, time
import requests
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Schedule, SystemConfig
from routers.config import get_config_value, set_config_value
from services.push import push_all, log_system


def should_notify(shift, now: datetime) -> str:
    """返回 work / worked / 空串"""
    if shift.is_rest:
        return ""
    now_t = now.time()
    today = now.date()
    start_dt = datetime.combine(today, shift.start_time)
    end_dt = datetime.combine(today, shift.end_time) + timedelta(minutes=shift.overtime_min)
    start_window = (start_dt - timedelta(minutes=shift.remind_before_min)).time()
    end_window = (end_dt + timedelta(minutes=shift.remind_after_min)).time()

    if start_window <= now_t < shift.start_time:
        return "work"
    if end_dt.time() < now_t <= end_window:
        return "worked"
    return ""


def query_vika_status(api_key: str, dst_id: str, row: int) -> str:
    url = f"https://api.vika.cn/fusion/v1/datasheets/{dst_id}/records"
    headers = {"Authorization": f"Bearer {api_key}"}
    r = requests.get(url, headers=headers, params={"pageSize": 2}, timeout=5)
    r.raise_for_status()
    records = r.json()["data"]["records"]
    return records[row - 1]["fields"]["打卡检测"]


def is_skipped_today(db: Session) -> bool:
    key = f"skip_{date.today().isoformat()}"
    val = get_config_value(db, key)
    return val == "1"


def run_check():
    db = SessionLocal()
    try:
        now = datetime.now()

        # 检查今日跳过
        if is_skipped_today(db):
            return

        today = date.today()
        row = db.query(Schedule).filter(Schedule.date == today).first()
        if not row or not row.shift_template:
            return

        shift = row.shift_template
        if shift.is_rest:
            return

        action = should_notify(shift, now)
        if not action:
            return

        api_key = get_config_value(db, "API_KEY")
        dst_id = get_config_value(db, "DST_ID")
        fs_webhook = get_config_value(db, "fs_webhook")
        fw_webhook = get_config_value(db, "fw_webhook")

        if not api_key or not dst_id:
            return

        if action == "work":
            local_status = get_config_value(db, "clockInDetection") or "上班未打卡"
            if local_status != "上班未打卡":
                return
            try:
                status = query_vika_status(api_key, dst_id, 1)
            except Exception as e:
                log_system(db, "system", f"查询上班打卡状态失败: {e}")
                return
            if status == "上班未打卡":
                push_all(db, "work", "上班打卡咯", fs_webhook, fw_webhook)
            set_config_value(db, "clockInDetection", status)

        elif action == "worked":
            local_status = get_config_value(db, "clockOutDetection") or "下班未打卡"
            if local_status != "下班未打卡":
                return
            try:
                status = query_vika_status(api_key, dst_id, 2)
            except Exception as e:
                log_system(db, "system", f"查询下班打卡状态失败: {e}")
                return
            if status == "下班未打卡":
                push_all(db, "worked", "下班打卡咯", fs_webhook, fw_webhook)
            set_config_value(db, "clockOutDetection", status)

    finally:
        db.close()
