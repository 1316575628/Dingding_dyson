from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from typing import List
from pydantic import BaseModel

from database import get_db
from models import PushLog

router = APIRouter(prefix="/logs", tags=["logs"])


class LogOut(BaseModel):
    id: int
    timestamp: datetime
    log_type: str
    channel: str
    result: str
    level: str
    detail: str | None

    class Config:
        from_attributes = True


@router.get("")
def list_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    log_type: str | None = None,
    channel: str | None = None,
    result: str | None = None,
    level: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    keyword: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(PushLog)

    if log_type:
        query = query.filter(PushLog.log_type == log_type)
    if channel:
        query = query.filter(PushLog.channel == channel)
    if result:
        query = query.filter(PushLog.result == result)
    if level:
        query = query.filter(PushLog.level == level)
    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        query = query.filter(PushLog.timestamp >= start_dt)
    if end_date:
        end_dt = datetime.combine(end_date, datetime.max.time())
        query = query.filter(PushLog.timestamp <= end_dt)
    if keyword:
        query = query.filter(PushLog.detail.contains(keyword))

    total = query.count()
    rows = (
        query.order_by(PushLog.timestamp.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": rows,
    }


@router.get("/stats")
def log_stats(db: Session = Depends(get_db)):
    total = db.query(PushLog).count()
    success = db.query(PushLog).filter(PushLog.result == "success").count()
    fail = db.query(PushLog).filter(PushLog.result == "fail").count()
    return {"total": total, "success": success, "fail": fail}
