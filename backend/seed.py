import json
import os
from sqlalchemy.orm import Session

from database import SessionLocal
from models import ShiftTemplate, SystemConfig


def seed_data():
    db = SessionLocal()
    try:
        # 默认班次
        defaults = [
            {
                "name": "A班",
                "color": "#1890ff",
                "start_time": "09:00",
                "end_time": "18:00",
                "remind_before_min": 15,
                "remind_after_min": 30,
                "overtime_min": 0,
                "is_rest": False,
            },
            {
                "name": "P班",
                "color": "#52c41a",
                "start_time": "13:00",
                "end_time": "22:00",
                "remind_before_min": 15,
                "remind_after_min": 30,
                "overtime_min": 0,
                "is_rest": False,
            },
            {
                "name": "休",
                "color": "#999999",
                "start_time": None,
                "end_time": None,
                "remind_before_min": 0,
                "remind_after_min": 0,
                "overtime_min": 0,
                "is_rest": True,
            },
        ]

        for item in defaults:
            existing = db.query(ShiftTemplate).filter(ShiftTemplate.name == item["name"]).first()
            if not existing:
                from datetime import time as dt_time
                shift = ShiftTemplate(
                    name=item["name"],
                    color=item["color"],
                    start_time=dt_time.fromisoformat(item["start_time"]) if item["start_time"] else None,
                    end_time=dt_time.fromisoformat(item["end_time"]) if item["end_time"] else None,
                    remind_before_min=item["remind_before_min"],
                    remind_after_min=item["remind_after_min"],
                    overtime_min=item["overtime_min"],
                    is_rest=item["is_rest"],
                )
                db.add(shift)

        # 从 config.json 初始化系统配置（兼容本地开发和 Docker 挂载）
        config_paths = [
            "/data/config.json",
            os.path.join(os.path.dirname(__file__), "config.json"),
            os.path.join(os.path.dirname(__file__), "..", "config.json"),
        ]
        config_path = None
        for p in config_paths:
            if os.path.exists(p) and os.path.isfile(p):
                config_path = p
                break
        if config_path:
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                for key, value in cfg.items():
                    existing = db.query(SystemConfig).filter(SystemConfig.key == key).first()
                    if not existing:
                        db.add(SystemConfig(key=key, value=str(value)))
            except Exception as e:
                print(f"[seed] 读取 config.json 失败 ({config_path}): {e}")

        # 默认日志保留天数
        if not db.query(SystemConfig).filter(SystemConfig.key == "log_retention_days").first():
            db.add(SystemConfig(key="log_retention_days", value="7"))

        db.commit()
    finally:
        db.close()
