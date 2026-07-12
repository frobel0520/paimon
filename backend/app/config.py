import os
from pathlib import Path

_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


def _load_dotenv() -> None:
    """讀取 backend/.env（KEY=VALUE 格式），已存在的環境變數優先。"""
    if not _ENV_PATH.exists():
        return
    for line in _ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


_load_dotenv()

GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()

# 店家營業時間快取超過此天數即視為過期，前端會觸發重新抓取
PLACES_REFRESH_DAYS = int(os.environ.get("PLACES_REFRESH_DAYS", "7"))
