from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date
from pydantic import BaseModel

from database import get_db
from models import SystemConfig
from routers.config import set_config_value

router = APIRouter(prefix="/skip", tags=["skip"])


class SkipPayload(BaseModel):
    skipped: bool


@router.post("/today")
def skip_today(payload: SkipPayload, db: Session = Depends(get_db)):
    key = f"skip_{date.today().isoformat()}"
    set_config_value(db, key, "1" if payload.skipped else "0")
    return {"skipped": payload.skipped}


@router.get("/today")
def get_skip_today(db: Session = Depends(get_db)):
    key = f"skip_{date.today().isoformat()}"
    val = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    return {"skipped": val.value == "1" if val else False}
