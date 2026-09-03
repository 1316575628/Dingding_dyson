import json
import os
from pathlib import Path

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


def _config_file_paths() -> list[Path]:
    """返回可能的 config.json 路径，按优先级排列。"""
    return [
        Path("/data/config.json"),
        Path(__file__).parent.parent / "config.json",
        Path(__file__).parent.parent.parent / "config.json",
    ]


def load_config_from_file(path: Path, db: Session, overwrite: bool = True):
    """从指定 JSON 文件读取配置并写入数据库。

    Args:
        overwrite: 为 True 时覆盖数据库中已存在的同名配置；
                   为 False 时仅导入数据库中不存在的配置。
    """
    with open(path, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    for key, value in cfg.items():
        existing = db.query(SystemConfig).filter(SystemConfig.key == key).first()
        if existing:
            if overwrite:
                existing.value = str(value)
        else:
            db.add(SystemConfig(key=key, value=str(value)))
    db.commit()


@router.post("/reload")
def reload_config(db: Session = Depends(get_db)):
    """从磁盘 config.json 热重载配置，无需重启后端。"""
    config_path = None
    for p in _config_file_paths():
        if p.exists() and p.is_file():
            config_path = p
            break

    if not config_path:
        return {"message": "未找到 config.json，未执行重载", "path": None}

    load_config_from_file(config_path, db)
    return {"message": "配置已热重载", "path": str(config_path)}
