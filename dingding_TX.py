#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
钉钉 + 飞书 双推送 单文件版（飞书 webhook 可配置）
路径兼容 1Panel / crontab
"""
import json
import os
import sys
from datetime import datetime, timedelta
import requests
from loguru import logger

# ================= 0. 路径（只改 ROOT_DIR） =================
ROOT_DIR = "."  # 当前目录；1Panel 可改成 "/opt/dingding"
CONFIG_FILE   = os.path.join(ROOT_DIR, "config.json")   # 配置文件
SCHEDULE_FILE = os.path.join(ROOT_DIR, "data.json")     # 排班表
LOG_FILE      = os.path.join(ROOT_DIR, "logs", "dingding.log")  # 日志文件

os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
logger.remove()
logger.add(sys.stderr, level="INFO", colorize=True,
           format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <level>{message}</level>")
logger.add(LOG_FILE, rotation="1 day", retention="7 days", encoding="utf-8")

# ================= 1. 读配置（原文不动） =================
def load_config(path):
    """加载 config.json，缺少必填字段直接退出"""
    try:
        with open(path, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        must_keys = ["API_KEY", "DST_ID", "fs_webhook", "fw_webhook",
                     "clockInDetection", "clockOutDetection", "work_overtime"]
        for k in must_keys:
            if k not in cfg:
                logger.error(f"配置缺少 {k}")
                sys.exit(1)
        return cfg
    except Exception as e:
        logger.error(f"读取 config 失败：{e}")
        sys.exit(1)

CFG = load_config(CONFIG_FILE)

# ================= 2. 常量（只改名） =================
VIKA_URL = f"https://api.vika.cn/fusion/v1/datasheets/{CFG['DST_ID']}/records"
HEADERS  = {"Authorization": f"Bearer {CFG['API_KEY']}"}
WORK_OVERTIME = int(CFG["work_overtime"])
SHIFT_A = {"start": "09:00", "end": "18:00"}
SHIFT_B = {"start": "13:00", "end": "22:00"}

# ================= 3. 双推函数（只改 URL 取法 + 简洁日志） =================
def push(msg: str):
    """飞书 + fwalert 一起推，失败仅写日志不中断"""
    # 1. 飞书
    try:
        requests.post(CFG["fs_webhook"], json={"msg_type": "text", "content": {"text": msg}}, timeout=5)
        logger.info(f"✅ 飞书推送成功：{msg}")
    except Exception as e:
        logger.warning(f"❌ 飞书推送失败：{e}")

    # 2. fwalert（上班/下班 url 已填在 config）
    url = CFG["fw_webhook"] + msg          # ← 直接拼接
    try:
        r = requests.post(url, timeout=5)
        r.raise_for_status()
        logger.info("✅ fwalert 推送成功")   # ← 不打印完整 URL
    except Exception as e:
        logger.warning(f"❌ fwalert 推送失败：{e}")

# ================= 4. 工具（原文不动） =================
def read_json(path):
    """读任意 json，失败抛异常"""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def write_config(key, value):
    """把最新云端结果写回本地 config.json"""
    CFG[key] = value
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(CFG, f, ensure_ascii=False, indent=4)
        logger.debug(f"config 回写 {key}={value}")
    except Exception as e:
        logger.error(f"config 回写失败：{e}")

# ================= 5. 排班（原文不动） =================
def today_shift():
    """返回今日班次对象，休息返回 None"""
    if not os.path.isfile(SCHEDULE_FILE):
        logger.error(f"排班文件不存在：{SCHEDULE_FILE}")
        return None
    sched = read_json(SCHEDULE_FILE)
    y, m, d = datetime.now().strftime("%Y-%m-%d").split("-")
    name = sched.get(y, {}).get(m, {}).get(d, "休")
    if name == "休":
        return None
    src = SHIFT_A if name == "A" else SHIFT_B
    return {
        "name": name,
        "start": datetime.strptime(src["start"], "%H:%M").time(),
        "end": datetime.strptime(src["end"], "%H:%M").time()
    }

# ================= 6. 时间窗口（原文不动） =================
def should_notify(shift):
    """返回 work / worked / 空串，空串=不在打卡窗口"""
    now = datetime.now().time()
    today = datetime.today()
    start_dt = datetime.combine(today, shift["start"])
    end_dt   = datetime.combine(today, shift["end"]) + timedelta(minutes=WORK_OVERTIME)
    start_window = (start_dt - timedelta(minutes=15)).time()
    end_window   = (end_dt + timedelta(minutes=30)).time()
    logger.debug(f"班次={shift['name']} 现在={now} 上班窗口={start_window}-{shift['start']} 下班窗口={end_dt.time()}-{end_window}")
    if start_window <= now < shift["start"]:
        return "work"
    if end_dt.time() < now <= end_window:
        return "worked"
    return ""

# ================= 7. 维格表（原文不动） =================
def vika_status(row):
    """取维格表第 row 行（1=上班，2=下班）打卡状态，失败抛异常"""
    params = {"pageSize": 2}
    r = requests.get(VIKA_URL, headers=HEADERS, params=params, timeout=5)
    r.raise_for_status()
    status = r.json()["data"]["records"][row - 1]["fields"]["打卡检测"]
    logger.info(f"维格表返回：{status}")
    return status

# ================= 8. 当前状态汇总（仅新增这个函数 + 1 行调用） =================
def print_status(now, shift):
    """每次运行必打：当前时间、今日班次、是否打卡窗口"""
    if shift is None:
        logger.info("【状态】当前时间：{} | 今日休息", now.strftime("%Y-%m-%d %H:%M"))
        return
    today = datetime.today()
    start_dt = datetime.combine(today, shift["start"])
    end_dt   = datetime.combine(today, shift["end"]) + timedelta(minutes=WORK_OVERTIME)
    start_window = (start_dt - timedelta(minutes=15)).time()
    end_window   = (end_dt + timedelta(minutes=30)).time()
    now_t = now.time()
    if start_window <= now_t < shift["start"]:
        window = "上班打卡时间"
    elif end_dt.time() < now_t <= end_window:
        window = "下班打卡时间"
    else:
        window = "非打卡时间"
    logger.info("【状态】当前时间：{} | 今日班次：{} | 当前是否在打卡时间段：{}",
                now.strftime("%Y-%m-%d %H:%M"), shift["name"], window)

# ================= 10. 主函数（完全复刻旧版 if 顺序） =================
def main():
    now = datetime.now()
    shift = today_shift()
    print_status(now, shift)          # 仅新增日志，不影响逻辑

    # ---- 旧版逻辑：窗口 + 本地未打卡 才查云端 ----
    if shift is None:
        logger.info("今天休息")
        return

    action = should_notify(shift)
    # 上班分支：只在窗口且本地==“上班未打卡”时才查云端
    if action == "work" and CFG["clockInDetection"] == "上班未打卡":
        status = vika_status(1)                       # 查云端
        if status == "上班未打卡":                   # 云端也显示未打卡
            push("上班打卡咯")                       # 双推
        write_config("clockInDetection", status)     # 把云端结果落盘

    # 下班分支：同理
    elif action == "worked" and CFG["clockOutDetection"] == "下班未打卡":
        status = vika_status(2)
        if status == "下班未打卡":
            push("下班打卡咯")
        write_config("clockOutDetection", status)

    # 其余 = 已打卡 / 非窗口 / 休息
    else:
        logger.info("已打卡或非打卡时间")


if __name__ == "__main__":
    main()