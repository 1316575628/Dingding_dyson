from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date, timedelta
from pydantic import BaseModel

from database import get_db
from models import Schedule, ShiftTemplate

router = APIRouter(prefix="/schedule", tags=["schedule"])


class ScheduleSet(BaseModel):
    date: str
    shift_template_id: int | None = None


class ScheduleOut(BaseModel):
    date: str
    shift_template_id: int | None
    shift_name: str | None
    color: str | None
    is_rest: bool | None


def serialize_schedule(s: Schedule) -> dict:
    return {
        "date": s.date.isoformat(),
        "shift_template_id": s.shift_template_id,
        "shift_name": s.shift_template.name if s.shift_template else None,
        "color": s.shift_template.color if s.shift_template else None,
        "is_rest": s.shift_template.is_rest if s.shift_template else None,
    }


@router.get("")
def get_schedule(year: int, month: int, db: Session = Depends(get_db)):
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)

    rows = (
        db.query(Schedule)
        .filter(Schedule.date >= start, Schedule.date < end)
        .all()
    )
    return [serialize_schedule(r) for r in rows]


@router.get("/range")
def get_schedule_range(start: str, end: str, db: Session = Depends(get_db)):
    start_date = date.fromisoformat(start)
    end_date = date.fromisoformat(end)
    rows = (
        db.query(Schedule)
        .filter(Schedule.date >= start_date, Schedule.date <= end_date)
        .all()
    )
    return [serialize_schedule(r) for r in rows]


@router.post("/set")
def set_schedule(payload: ScheduleSet, db: Session = Depends(get_db)):
    d = date.fromisoformat(payload.date)

    if payload.shift_template_id is not None:
        shift = db.query(ShiftTemplate).filter(ShiftTemplate.id == payload.shift_template_id).first()
        if not shift:
            raise HTTPException(status_code=404, detail="班次不存在")

    existing = db.query(Schedule).filter(Schedule.date == d).first()
    if existing:
        if payload.shift_template_id is None:
            db.delete(existing)
        else:
            existing.shift_template_id = payload.shift_template_id
    else:
        if payload.shift_template_id is not None:
            new = Schedule(date=d, shift_template_id=payload.shift_template_id)
            db.add(new)

    db.commit()
    return {"message": "设置成功"}
