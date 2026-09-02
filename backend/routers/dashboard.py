from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from pydantic import BaseModel

from database import get_db
from models import Schedule, SystemConfig
from routers.config import get_config_value
from engine import should_notify, query_vika_status

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(db: Session = Depends(get_db)):
    today = date.today()
    now = datetime.now()

    row = db.query(Schedule).filter(Schedule.date == today).first()
    shift = row.shift_template if row else None

    result = {
        "today": today.isoformat(),
        "now": now.strftime("%Y-%m-%d %H:%M:%S"),
        "shift": None,
        "window": "休息",
        "clock_in_status": None,
        "clock_out_status": None,
        "skipped": is_skipped_today(db),
    }

    if shift:
        result["shift"] = {
            "id": shift.id,
            "name": shift.name,
            "color": shift.color,
            "start_time": shift.start_time.strftime("%H:%M") if shift.start_time else None,
            "end_time": shift.end_time.strftime("%H:%M") if shift.end_time else None,
            "is_rest": shift.is_rest,
        }

        if shift.is_rest:
            result["window"] = "休息"
        else:
            window = should_notify(shift, now)
            if window == "work":
                result["window"] = "上班打卡时间"
            elif window == "worked":
                result["window"] = "下班打卡时间"
            else:
                result["window"] = "非打卡时间"

    # 查询云端状态（仅在配置完整时）
    api_key = get_config_value(db, "API_KEY")
    dst_id = get_config_value(db, "DST_ID")
    if api_key and dst_id:
        try:
            result["clock_in_status"] = query_vika_status(api_key, dst_id, 1)
            result["clock_out_status"] = query_vika_status(api_key, dst_id, 2)
        except Exception as e:
            result["clock_in_status"] = f"查询失败: {e}"
            result["clock_out_status"] = f"查询失败: {e}"

    return result


def is_skipped_today(db: Session) -> bool:
    key = f"skip_{date.today().isoformat()}"
    val = get_config_value(db, key)
    return val == "1"
