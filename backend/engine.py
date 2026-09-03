from datetime import datetime, date, timedelta, time
import requests
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Schedule, SystemConfig
from routers.config import get_config_value, set_config_value
from services.push import push_all, log_info, log_warn, log_error


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


def reset_daily_status(db: Session):
    """新的一天开始时重置上下班打卡状态"""
    today = date.today().isoformat()
    last_date = get_config_value(db, "last_check_date")
    if last_date != today:
        set_config_value(db, "clockInDetection", "上班未打卡")
        set_config_value(db, "clockOutDetection", "下班未打卡")
        set_config_value(db, "last_check_date", today)
        log_info(db, "system", f"新的一天 {today}，重置打卡检测状态")


def run_check():
    db = SessionLocal()
    try:
        now = datetime.now()
        log_info(db, "system", f"开始第 {now.strftime('%Y-%m-%d %H:%M:%S')} 次打卡检查")

        # 新的一天自动重置状态
        reset_daily_status(db)

        # 检查今日跳过
        if is_skipped_today(db):
            log_info(db, "system", "今日已设置跳过打卡提醒")
            return

        today = date.today()
        row = db.query(Schedule).filter(Schedule.date == today).first()
        if not row or not row.shift_template:
            log_info(db, "system", f"今日 {today.isoformat()} 无排班，跳过")
            return

        shift = row.shift_template
        if shift.is_rest:
            log_info(db, "system", f"今日班次 [{shift.name}] 为休息类型，跳过")
            return

        action = should_notify(shift, now)
        if not action:
            log_info(db, "system", f"当前不在打卡窗口：班次 [{shift.name}]，时间 {now.strftime('%H:%M')}")
            return

        log_info(db, "system", f"进入打卡窗口：{action}，班次 [{shift.name}]")

        api_key = get_config_value(db, "API_KEY")
        dst_id = get_config_value(db, "DST_ID")
        fs_webhook = get_config_value(db, "fs_webhook")
        fw_webhook = get_config_value(db, "fw_webhook")

        if not api_key or not dst_id:
            log_error(db, "system", "缺少 API_KEY 或 DST_ID，无法查询维格表")
            return

        if action == "work":
            local_status = get_config_value(db, "clockInDetection") or "上班未打卡"
            log_info(db, "system", f"本地上班状态：{local_status}")
            if local_status != "上班未打卡":
                log_info(db, "system", "本地已记录上班打卡，跳过推送")
                return
            try:
                status = query_vika_status(api_key, dst_id, 1)
                log_info(db, "system", f"维格表上班状态：{status}")
            except Exception as e:
                log_error(db, "system", f"查询上班打卡状态失败: {e}")
                return
            if status == "上班未打卡":
                log_info(db, "system", "云端显示上班未打卡，准备推送提醒")
                push_all(db, "work", "上班打卡咯", fs_webhook, fw_webhook)
            else:
                log_info(db, "system", "云端显示上班已打卡，无需推送")
            set_config_value(db, "clockInDetection", status)

        elif action == "worked":
            local_status = get_config_value(db, "clockOutDetection") or "下班未打卡"
            log_info(db, "system", f"本地下班状态：{local_status}")
            if local_status != "下班未打卡":
                log_info(db, "system", "本地已记录下班打卡，跳过推送")
                return
            try:
                status = query_vika_status(api_key, dst_id, 2)
                log_info(db, "system", f"维格表下班状态：{status}")
            except Exception as e:
                log_error(db, "system", f"查询下班打卡状态失败: {e}")
                return
            if status == "下班未打卡":
                log_info(db, "system", "云端显示下班未打卡，准备推送提醒")
                push_all(db, "worked", "下班打卡咯", fs_webhook, fw_webhook)
            else:
                log_info(db, "system", "云端显示下班已打卡，无需推送")
            set_config_value(db, "clockOutDetection", status)

    except Exception as e:
        log_error(db, "system", f"打卡检查异常: {e}")
    finally:
        db.close()
