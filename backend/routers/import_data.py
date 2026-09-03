from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from datetime import date
import json
import re

from database import get_db
from models import ShiftTemplate, Schedule, PushLog
from services.push import log_info

router = APIRouter(prefix="/import", tags=["import"])


@router.post("/schedule-json")
def import_schedule_json(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = file.file.read().decode("utf-8")
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        # 兼容原 data.json 中可能出现的 trailing comma
        cleaned = re.sub(r",\s*}", "}", content)
        cleaned = re.sub(r",\s*]", "]", cleaned)
        data = json.loads(cleaned)

    created_shifts = 0
    imported_days = 0
    skipped_days = 0

    # 预建休息模板
    rest_shift = db.query(ShiftTemplate).filter(ShiftTemplate.name == "休").first()
    if not rest_shift:
        rest_shift = ShiftTemplate(
            name="休",
            color="#999999",
            start_time=None,
            end_time=None,
            is_rest=True,
        )
        db.add(rest_shift)
        db.flush()
        created_shifts += 1

    for year_str, months in data.items():
        year = int(year_str)
        for month_str, days in months.items():
            month = int(month_str)
            for day_str, shift_name in days.items():
                day = int(day_str)

                # 只接受字符串班次名；过滤明显不是班次的异常值（如 "25/4/9"）
                if not isinstance(shift_name, str):
                    skipped_days += 1
                    continue
                if not re.match(r"^[A-Za-z0-9\u4e00-\u9fa5]+$", shift_name):
                    skipped_days += 1
                    continue

                if shift_name == "休":
                    shift = rest_shift
                else:
                    # 优先匹配完全相同的名称；其次匹配 "{name}班"
                    shift = db.query(ShiftTemplate).filter(ShiftTemplate.name == shift_name).first()
                    if not shift:
                        shift = db.query(ShiftTemplate).filter(ShiftTemplate.name == f"{shift_name}班").first()
                    if not shift:
                        shift = ShiftTemplate(
                            name=shift_name,
                            color="#1890ff",
                            start_time=None,
                            end_time=None,
                            is_rest=False,
                        )
                        db.add(shift)
                        db.flush()
                        created_shifts += 1

                d = date(year, month, day)
                existing = db.query(Schedule).filter(Schedule.date == d).first()
                if existing:
                    existing.shift_template_id = shift.id
                else:
                    db.add(Schedule(date=d, shift_template_id=shift.id))
                imported_days += 1

    db.commit()

    log_info(db, "system", f"导入排班 JSON：创建 {created_shifts} 个班次，导入 {imported_days} 天，跳过 {skipped_days} 天异常数据")

    return {
        "message": "导入成功",
        "created_shifts": created_shifts,
        "imported_days": imported_days,
        "skipped_days": skipped_days,
    }
