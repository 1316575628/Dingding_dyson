from datetime import datetime, date, timedelta
import re

import requests
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Schedule, SystemConfig
from routers.config import get_config_value, set_config_value
from services.push import push_all, log_info, log_warn, log_error

# 带日期后缀的按日状态 key（clockInDetection_2026-09-03 / skip_2026-09-03 等）
_DAILY_KEY_RE = re.compile(r"^(clockInDetection|clockOutDetection|skip)_\d{4}-\d{2}-\d{2}$")


def is_punched(status: str | None) -> bool:
    """判断打卡状态是否为「已打卡」。

    只有从云端明确拉取到包含「已打卡」的状态才视为已打卡；
    「未打卡」「已提醒」、空值等一律视为未确认打卡，需要继续检测/提醒。
    """
    return bool(status) and "已打卡" in status


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
    """新的一天开始时重置当天上下班打卡状态，并清理历史日期的状态 key"""
    today = date.today().isoformat()
    last_date = get_config_value(db, "last_check_date")
    if last_date != today:
        clock_in_key = f"clockInDetection_{today}"
        clock_out_key = f"clockOutDetection_{today}"

        # 兼容旧版无日期后缀的状态 key：首次升级时仅迁移「已打卡」状态，
        # 旧的「已提醒」不代表已打卡，不迁移（视为未打卡重新检测）
        if last_date is None:
            old_in = get_config_value(db, "clockInDetection")
            old_out = get_config_value(db, "clockOutDetection")
            if is_punched(old_in):
                set_config_value(db, clock_in_key, old_in)
            if is_punched(old_out):
                set_config_value(db, clock_out_key, old_out)
            # 删除旧版无日期后缀的残留 key
            db.query(SystemConfig).filter(
                SystemConfig.key.in_(["clockInDetection", "clockOutDetection"])
            ).delete(synchronize_session=False)
            db.commit()
            log_info(db, "system", f"检测到旧版状态，已迁移至 {today}")

        # 如果当天还没有状态，则初始化为未打卡
        if get_config_value(db, clock_in_key) is None:
            set_config_value(db, clock_in_key, "上班未打卡")
        if get_config_value(db, clock_out_key) is None:
            set_config_value(db, clock_out_key, "下班未打卡")
        set_config_value(db, "last_check_date", today)

        # 清理历史日期的状态 key（含旧版迁移残留），避免无限累积
        stale_keys = [
            row.key
            for row in db.query(SystemConfig).all()
            if _DAILY_KEY_RE.match(row.key) and not row.key.endswith(f"_{today}")
        ]
        if stale_keys:
            db.query(SystemConfig).filter(SystemConfig.key.in_(stale_keys)).delete(
                synchronize_session=False
            )
            db.commit()

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
            local_status = get_config_value(db, clock_in_key)
            log_info(db, "system", f"本地上班状态：{local_status or '上班未打卡'}")
            # 本地缓存的唯一作用：已从云端确认「已打卡」后，不再重复请求云端和推送
            if is_punched(local_status):
                log_info(db, "system", "本地已缓存云端确认的上班打卡状态，跳过检测与推送")
                return
            # 未确认打卡：每次检查都从云端拉取最新状态
            try:
                status = query_vika_status(api_key, dst_id, 1)
                log_info(db, "system", f"维格表上班状态：{status}")
            except Exception as e:
                log_error(db, "system", f"查询上班打卡状态失败: {e}")
                return
            if is_punched(status):
                # 云端已打卡：同步到本地缓存，此后停止提醒
                set_config_value(db, clock_in_key, status)
                log_info(db, "system", f"云端显示上班已打卡（{status}），已同步本地，停止提醒")
            else:
                # 云端未确认打卡：持续推送提醒，直到云端出现已打卡状态
                log_info(db, "system", "云端显示上班未打卡，准备推送提醒")
                push_all(db, "work", "上班打卡咯", fs_webhook, fw_webhook)

        elif action == "worked":
            local_status = get_config_value(db, clock_out_key)
            log_info(db, "system", f"本地下班状态：{local_status or '下班未打卡'}")
            if is_punched(local_status):
                log_info(db, "system", "本地已缓存云端确认的下班打卡状态，跳过检测与推送")
                return
            try:
                status = query_vika_status(api_key, dst_id, 2)
                log_info(db, "system", f"维格表下班状态：{status}")
            except Exception as e:
                log_error(db, "system", f"查询下班打卡状态失败: {e}")
                return
            if is_punched(status):
                set_config_value(db, clock_out_key, status)
                log_info(db, "system", f"云端显示下班已打卡（{status}），已同步本地，停止提醒")
            else:
                log_info(db, "system", "云端显示下班未打卡，准备推送提醒")
                push_all(db, "worked", "下班打卡咯", fs_webhook, fw_webhook)

    except Exception as e:
        log_error(db, "system", f"打卡检查异常: {e}")
    finally:
        db.close()
