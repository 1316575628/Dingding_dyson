from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from pydantic import BaseModel, field_validator, model_validator
from datetime import time

from database import get_db
from models import ShiftTemplate

router = APIRouter(prefix="/shifts", tags=["shifts"])


def _validate_hhmm(value: str | None) -> str | None:
    if value is None:
        return value
    try:
        time.fromisoformat(value)
    except ValueError:
        raise ValueError("时间格式必须为 HH:MM（如 09:00）")
    return value


class ShiftCreate(BaseModel):
    name: str
    color: str = "#1890ff"
    start_time: str | None = None
    end_time: str | None = None
    remind_before_min: int = 15
    remind_after_min: int = 30
    overtime_min: int = 0
    is_rest: bool = False

    @field_validator("start_time", "end_time")
    @classmethod
    def check_time_format(cls, v):
        return _validate_hhmm(v)

    @model_validator(mode="after")
    def check_work_shift_times(self):
        if not self.is_rest and (not self.start_time or not self.end_time):
            raise ValueError("非休息班次必须填写上下班时间")
        return self


class ShiftUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    remind_before_min: int | None = None
    remind_after_min: int | None = None
    overtime_min: int | None = None
    is_rest: bool | None = None

    @field_validator("start_time", "end_time")
    @classmethod
    def check_time_format(cls, v):
        return _validate_hhmm(v)


class ShiftOut(BaseModel):
    id: int
    name: str
    color: str
    start_time: str | None
    end_time: str | None
    remind_before_min: int
    remind_after_min: int
    overtime_min: int
    is_rest: bool

    class Config:
        from_attributes = True


def time_to_str(t: time | None) -> str | None:
    return t.strftime("%H:%M") if t else None


def str_to_time(s: str) -> time:
    h, m = s.split(":")
    return time(int(h), int(m))


def serialize_shift(shift: ShiftTemplate) -> dict:
    return {
        "id": shift.id,
        "name": shift.name,
        "color": shift.color,
        "start_time": time_to_str(shift.start_time),
        "end_time": time_to_str(shift.end_time),
        "remind_before_min": shift.remind_before_min,
        "remind_after_min": shift.remind_after_min,
        "overtime_min": shift.overtime_min,
        "is_rest": shift.is_rest,
    }


@router.get("", response_model=List[ShiftOut])
def list_shifts(db: Session = Depends(get_db)):
    shifts = db.query(ShiftTemplate).order_by(ShiftTemplate.id).all()
    return [serialize_shift(s) for s in shifts]


@router.post("", response_model=ShiftOut)
def create_shift(payload: ShiftCreate, db: Session = Depends(get_db)):
    if db.query(ShiftTemplate).filter(ShiftTemplate.name == payload.name).first():
        raise HTTPException(status_code=400, detail="班次名称已存在")

    shift = ShiftTemplate(
        name=payload.name,
        color=payload.color,
        start_time=str_to_time(payload.start_time) if payload.start_time else None,
        end_time=str_to_time(payload.end_time) if payload.end_time else None,
        remind_before_min=payload.remind_before_min,
        remind_after_min=payload.remind_after_min,
        overtime_min=payload.overtime_min,
        is_rest=payload.is_rest,
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return serialize_shift(shift)


@router.put("/{shift_id}", response_model=ShiftOut)
def update_shift(shift_id: int, payload: ShiftUpdate, db: Session = Depends(get_db)):
    shift = db.query(ShiftTemplate).filter(ShiftTemplate.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="班次不存在")

    if payload.name is not None:
        existing = db.query(ShiftTemplate).filter(ShiftTemplate.name == payload.name).first()
        if existing and existing.id != shift_id:
            raise HTTPException(status_code=400, detail="班次名称已存在")
        shift.name = payload.name
    if payload.color is not None:
        shift.color = payload.color
    if payload.start_time is not None:
        shift.start_time = str_to_time(payload.start_time)
    if payload.end_time is not None:
        shift.end_time = str_to_time(payload.end_time)
    if payload.remind_before_min is not None:
        shift.remind_before_min = payload.remind_before_min
    if payload.remind_after_min is not None:
        shift.remind_after_min = payload.remind_after_min
    if payload.overtime_min is not None:
        shift.overtime_min = payload.overtime_min
    if payload.is_rest is not None:
        shift.is_rest = payload.is_rest

    # 更新后若为非休息班次，必须确保上下班时间完整
    if not shift.is_rest and (shift.start_time is None or shift.end_time is None):
        raise HTTPException(status_code=400, detail="非休息班次必须填写上下班时间")

    db.commit()
    db.refresh(shift)
    return serialize_shift(shift)


@router.delete("/{shift_id}")
def delete_shift(shift_id: int, db: Session = Depends(get_db)):
    shift = db.query(ShiftTemplate).filter(ShiftTemplate.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="班次不存在")
    try:
        db.delete(shift)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="该班次已被排班使用，无法删除")
    return {"message": "删除成功"}
