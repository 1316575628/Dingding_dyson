import os
import shutil
import re
from datetime import datetime, timedelta
from pathlib import Path

from database import SessionLocal
from models import PushLog
from routers.config import get_config_value
from services.push import log_info, log_error


def _parse_retention_days(db) -> int:
    try:
        val = get_config_value(db, "log_retention_days")
        return int(val) if val else 7
    except Exception:
        return 7


def cleanup_logs():
    """每天清理超过保留天数的推送日志。"""
    db = SessionLocal()
    try:
        retention_days = _parse_retention_days(db)
        cutoff = datetime.now() - timedelta(days=retention_days)

        deleted = (
            db.query(PushLog)
            .filter(PushLog.timestamp < cutoff)
            .delete(synchronize_session=False)
        )
        db.commit()

        log_info(db, "system", f"日志清理完成：删除 {deleted} 条 {retention_days} 天前的记录")
    except Exception as e:
        db.rollback()
        log_error(db, "system", f"日志清理失败: {e}")
    finally:
        db.close()


def _ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def _cleanup_old_backups(backup_dir: Path, keep: int = 7):
    """只保留最近 keep 个备份目录。"""
    dirs = sorted(
        [d for d in backup_dir.iterdir() if d.is_dir() and re.match(r"^\d{8}_\d{6}$", d.name)],
        key=lambda d: d.name,
    )
    for old in dirs[:-keep]:
        shutil.rmtree(old, ignore_errors=True)


def backup_data():
    """每天备份 SQLite 数据库和 config.json。"""
    db = SessionLocal()
    try:
        data_dir = Path(os.getenv("DATA_DIR", "/data"))
        backup_base = data_dir / "backups"
        _ensure_dir(backup_base)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = backup_base / timestamp
        _ensure_dir(backup_dir)

        # 备份 SQLite 数据库
        db_url = os.getenv("DATABASE_URL", "sqlite:////data/dingding.db")
        if db_url.startswith("sqlite:///"):
            db_path = Path(db_url.replace("sqlite:////", "/"))
            if db_path.exists():
                shutil.copy2(db_path, backup_dir / "dingding.db")

        # 备份 config.json
        config_path = data_dir / "config.json"
        if config_path.exists():
            shutil.copy2(config_path, backup_dir / "config.json")

        # 保留最近 7 份
        _cleanup_old_backups(backup_base, keep=7)

        log_info(db, "system", f"数据备份完成：{backup_dir}")
    except Exception as e:
        log_error(db, "system", f"数据备份失败: {e}")
    finally:
        db.close()


