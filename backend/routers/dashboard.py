import time
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, date

from database import get_db
from models import Schedule
from routers.config import get_config_value
from engine import should_notify_for_date, query_vika_status

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class _TTLCache:
    """简单的线程安全 TTL 缓存（当前后端单进程使用足够）。"""

    def __init__(self, ttl_seconds: int = 30):
        self.ttl = ttl_seconds
        self._store: dict[tuple, tuple[str, float]] = {}

    def get(self, key: tuple) -> str | None:
        if key not in self._store:
            return None
        value, expire_at = self._store[key]
        if time.time() > expire_at:
            del self._store[key]
            return None
        return value

    def set(self, key: tuple, value: str):
        self._store[key] = (value, time.time() + self.ttl)


_vika_status_cache = _TTLCache(ttl_seconds=30)


@router.get("")
def dashboard(db: Session = Depends(get_db)):
    now = datetime.now()
    today = now.date()

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
            window = should_notify_for_date(shift, today, now)
            if window == "work":
                result["window"] = "上班打卡时间"
            elif window == "worked":
                result["window"] = "下班打卡时间"
            else:
                result["window"] = "非打卡时间"

    # 查询云端状态（仅在配置完整时），使用 TTL 缓存避免每次打开页面都阻塞请求
    api_key = get_config_value(db, "API_KEY")
    dst_id = get_config_value(db, "DST_ID")
    if api_key and dst_id:
        for row_num, result_key in ((1, "clock_in_status"), (2, "clock_out_status")):
            cache_key = (api_key, dst_id, row_num)
            cached = _vika_status_cache.get(cache_key)
            if cached is not None:
                result[result_key] = cached
                continue
            try:
                status = query_vika_status(api_key, dst_id, row_num)
                _vika_status_cache.set(cache_key, status)
                result[result_key] = status
            except Exception as e:
                result[result_key] = f"查询失败: {e}"

    return result


def is_skipped_today(db: Session) -> bool:
    key = f"skip_{date.today().isoformat()}"
    val = get_config_value(db, key)
    return val == "1"
