from datetime import datetime, date, timedelta
import requests
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Schedule, SystemConfig
from routers.config import get_config_value, set_config_value
from services.push import push_all, log_info, log_warn, log_error


def should_notify_for_date(shift, base_date: date, now: datetime) -> str:
    """返回 work / worked / 空串。

    基于 base_date（排班日期）计算班次窗口，正确处理：
    - 跨天夜班（end_time < start_time）
    - 凌晨班次的跨天 remind_before（如前一日 23:00 提醒次日 02:00 班次）
    """
    if shift.is_rest:
        return ""
    if shift.start_time is None or shift.end_time is None:
        return ""

    start_dt = datetime.combine(base_date, shift.start_time)

    # 如果下班时间早于上班时间，视为跨天夜班
    end_base = base_date + timedelta(days=1) if shift.end_time < shift.start_time else base_date
    end_dt = datetime.combine(end_base, shift.end_time) + timedelta(minutes=shift.overtime_min)

    work_start = start_dt - timedelta(minutes=shift.remind_before_min)
    work_end = start_dt

    worked_start = end_dt
    worked_end = end_dt + timedelta(minutes=shift.remind_after_min)

    if work_start <= now < work_end:
        return "work"
    if worked_start < now <= worked_end:
        return "worked"
    return ""


def query_vika_status(api_key: str, dst_id: str, row: int) -> str:
    url = f"https://api.vika.cn/fusion/v1/datasheets/{dst_id}/records"
    headers = {"Authorization": f"Bearer {api_key}"}
    r = requests.get(url, headers=headers, params={"pageSize": 2}, timeout=5)
    r.raise_for_status()
    records = r.json()["data"]["records"]
    if not records or row > len(records):
        raise ValueError(f"维格表记录不足，请求第 {row} 行，实际 {len(records)} 行")
    return records[row - 1]["fields"].get("打卡检测", "")


def is_skipped_today(db: Session) -> bool:
    key = f"skip_{date.today().isoformat()}"
    val = get_config_value(db, key)
    return val == "1"


def reset_daily_status(db: Session):
    """新的一天开始时重置当天上下班打卡状态"""
    today = date.today().isoformat()
    last_date = get_config_value(db, "last_check_date")
    if last_date != today:
        set_config_value(db, f"clockInDetection_{today}", "上班未打卡")
        set_config_value(db, f"clockOutDetection_{today}", "下班未打卡")
        set_config_value(db, "last_check_date", today)
        log_info(db, "system", f"新的一天 {today}，重置打卡检测状态")


def _find_current_schedule(db: Session, now: datetime):
    """查找当前处于打卡窗口的排班。

    同时检查今天、明天、昨天，覆盖：
    - 今天正常班次
    - 明天凌晨班次的跨天 remind_before
    - 昨天夜班的跨天 worked 提醒
    """
    today = now.date()
    for offset in (0, 1, -1):
        check_date = today + timedelta(days=offset)
        row = db.query(Schedule).filter(Schedule.date == check_date).first()
        if not row or not row.shift_template:
            continue
        action = should_notify_for_date(row.shift_template, check_date, now)
        if action:
            return check_date, row.shift_template, action
    return None, None, None


def run_check():
    db = SessionLocal()
    try:
        now = datetime.now()
        today = now.date()
        log_info(db, "system", f"开始第 {now.strftime('%Y-%m-%d %H:%M:%S')} 次打卡检查")

        # 新的一天自动重置状态
        reset_daily_status(db)

        # 检查今日跳过
        if is_skipped_today(db):
            log_info(db, "system", "今日已设置跳过打卡提醒")
            return

        check_date, shift, action = _find_current_schedule(db, now)
        if not shift or not action:
            log_info(db, "system", f"当前不在任何打卡窗口：时间 {now.strftime('%H:%M')}")
            return

        if shift.is_rest:
            log_info(db, "system", f"班次 [{shift.name}] 为休息类型，跳过")
            return

        log_info(db, "system", f"进入 {check_date.isoformat()} 打卡窗口：{action}，班次 [{shift.name}]")

        api_key = get_config_value(db, "API_KEY")
        dst_id = get_config_value(db, "DST_ID")
        fs_webhook = get_config_value(db, "fs_webhook")
        fw_webhook = get_config_value(db, "fw_webhook")

        if not api_key or not dst_id:
            log_error(db, "system", "缺少 API_KEY 或 DST_ID，无法查询维格表")
            return

        date_str = check_date.isoformat()
        clock_in_key = f"clockInDetection_{date_str}"
        clock_out_key = f"clockOutDetection_{date_str}"

        if action == "work":
            local_status = get_config_value(db, clock_in_key) or "上班未打卡"
            log_info(db, "system", f"本地上班状态：{local_status}")
            if local_status not in ("上班未打卡", ""):
                log_info(db, "system", "本地已记录上班打卡或已提醒，跳过推送")
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
                set_config_value(db, clock_in_key, "已提醒")
            else:
                log_info(db, "system", "云端显示上班已打卡，无需推送")
                set_config_value(db, clock_in_key, status)

        elif action == "worked":
            local_status = get_config_value(db, clock_out_key) or "下班未打卡"
            log_info(db, "system", f"本地下班状态：{local_status}")
            if local_status not in ("下班未打卡", ""):
                log_info(db, "system", "本地已记录下班打卡或已提醒，跳过推送")
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
                set_config_value(db, clock_out_key, "已提醒")
            else:
                log_info(db, "system", "云端显示下班已打卡，无需推送")
                set_config_value(db, clock_out_key, status)

    except Exception as e:
        log_error(db, "system", f"打卡检查异常: {e}")
    finally:
        db.close()
