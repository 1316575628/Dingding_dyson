import requests
from datetime import datetime
from sqlalchemy.orm import Session

from models import PushLog


def log_push(db: Session, log_type: str, channel: str, result: str, detail: str | None = None):
    log = PushLog(
        timestamp=datetime.now(),
        log_type=log_type,
        channel=channel,
        result=result,
        detail=detail,
    )
    db.add(log)
    db.commit()


def log_system(db: Session, channel: str, detail: str):
    log_push(db, "system", channel, "success", detail)


def push_feishu(webhook: str, msg: str) -> tuple[bool, str | None]:
    try:
        r = requests.post(
            webhook,
            json={"msg_type": "text", "content": {"text": msg}},
            timeout=5,
        )
        r.raise_for_status()
        return True, None
    except Exception as e:
        return False, str(e)


def push_fwalert(webhook: str, msg: str) -> tuple[bool, str | None]:
    try:
        url = webhook + msg
        r = requests.post(url, timeout=5)
        r.raise_for_status()
        return True, None
    except Exception as e:
        return False, str(e)


def push_all(db: Session, log_type: str, msg: str, fs_webhook: str | None, fw_webhook: str | None):
    if fs_webhook:
        ok, err = push_feishu(fs_webhook, msg)
        log_push(db, log_type, "feishu", "success" if ok else "fail", err)
    if fw_webhook:
        ok, err = push_fwalert(fw_webhook, msg)
        log_push(db, log_type, "fwalert", "success" if ok else "fail", err)
