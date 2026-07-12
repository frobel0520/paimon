"""Google Places API (New) 用戶端。

- Text Search（Pro SKU）：用店名找候選店家
- Place Details（Enterprise SKU，含營業時間）：抓單一店家詳細資料

營業時間快取在 DB，「現在是否營業」由前端以快取時段計算，
只有資料過期或手動更新時才會呼叫這裡，控制在免費額度內。
"""

import requests

from app.config import GOOGLE_MAPS_API_KEY
from app.errors import ApiError

_BASE = "https://places.googleapis.com/v1"
_SEARCH_FIELD_MASK = "places.id,places.displayName,places.formattedAddress"
_DETAIL_FIELD_MASK = ",".join(
    [
        "id",
        "displayName",
        "formattedAddress",
        "googleMapsUri",
        "businessStatus",
        "regularOpeningHours",
        "utcOffsetMinutes",
    ]
)


def _call(method: str, url: str, field_mask: str, json_body: dict | None = None) -> dict:
    if not GOOGLE_MAPS_API_KEY:
        raise ApiError(503, "後端尚未設定 GOOGLE_MAPS_API_KEY，請參考 backend/.env.example")
    headers = {"X-Goog-Api-Key": GOOGLE_MAPS_API_KEY, "X-Goog-FieldMask": field_mask}
    try:
        res = requests.request(method, url, headers=headers, json=json_body, timeout=10)
    except requests.RequestException as e:
        raise ApiError(502, f"無法連線 Google Places API：{e}")
    if res.status_code != 200:
        try:
            detail = res.json().get("error", {}).get("message", res.text)
        except ValueError:
            detail = res.text
        raise ApiError(502, f"Google Places API 錯誤（HTTP {res.status_code}）：{detail}")
    return res.json()


def search_places(query: str) -> list[dict]:
    """以關鍵字搜尋店家，回傳候選清單。"""
    data = _call(
        "POST",
        f"{_BASE}/places:searchText",
        _SEARCH_FIELD_MASK,
        {"textQuery": query, "languageCode": "zh-TW", "pageSize": 8},
    )
    return [
        {
            "place_id": p.get("id", ""),
            "name": (p.get("displayName") or {}).get("text", ""),
            "address": p.get("formattedAddress", ""),
        }
        for p in data.get("places", [])
    ]


def fetch_place_details(place_id: str) -> dict:
    """抓單一店家的詳細資料（含營業時間），回傳 Google 原始 JSON。"""
    return _call("GET", f"{_BASE}/places/{place_id}?languageCode=zh-TW", _DETAIL_FIELD_MASK)
