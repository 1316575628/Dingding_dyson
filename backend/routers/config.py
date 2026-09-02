from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict

from database import get_db
from models import SystemConfig

router = APIRouter(prefix="/config", tags=["config"])

DEFAULT_CONFIG_KEYS = [
    "API_KEY",
    "DST_ID",
    "fs_webhook",
    "fw_webhook",
    "clockInDetection",
    "clockOutDetection",
    "work_overtime",
    "log_retention_days",
    "email_smtp_host",
    "email_smtp_port",
    "email_username",
    "email_password",
    "email_to",
    "sms_provider",
    "sms_api_key",
]


class ConfigPayload(BaseModel):
    config: Dict[str, str | None]


def get_all_config(db: Session) -> Dict[str, str]:
    rows = db.query(SystemConfig).all()
    cfg = {r.key: r.value for r in rows}
    for key in DEFAULT_CONFIG_KEYS:
        if key not in cfg:
            cfg[key] = ""
    return cfg


@router.get("")
def read_config(db: Session = Depends(get_db)):
    return get_all_config(db)


@router.post("")
def save_config(payload: ConfigPayload, db: Session = Depends(get_db)):
    for key, value in payload.config.items():
        existing = db.query(SystemConfig).filter(SystemConfig.key == key).first()
        if existing:
            existing.value = value or ""
        else:
            db.add(SystemConfig(key=key, value=value or ""))
    db.commit()
    return get_all_config(db)


def get_config_value(db: Session, key: str) -> str | None:
    row = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    return row.value if row else None


def set_config_value(db: Session, key: str, value: str):
    row = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    if row:
        row.value = value
    else:
        db.add(SystemConfig(key=key, value=value))
    db.commit()
