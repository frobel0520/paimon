"""常去店家：搜尋、收藏、快取 Google Places 營業資訊。

「現在是否營業」由前端以快取的營業時段即時計算；
後端只在新增、手動更新、或前端判定資料過期時呼叫 Google。
"""

import json
from datetime import datetime

from flask import Blueprint, jsonify, request
from sqlalchemy import select

from app.config import GOOGLE_MAPS_API_KEY, PLACES_REFRESH_DAYS
from app.errors import ApiError
from app.google_places import fetch_place_details, search_places
from app.models import FavoritePlace
from app.routers.common import db_session, iso

bp = Blueprint("places", __name__)


def _place_json(p: FavoritePlace) -> dict:
    return {
        "id": p.id,
        "place_id": p.place_id,
        "name": p.name,
        "address": p.address,
        "maps_url": p.maps_url,
        "business_status": p.business_status,
        "opening_hours": json.loads(p.opening_hours_json) if p.opening_hours_json else None,
        "utc_offset_minutes": p.utc_offset_minutes,
        "last_refreshed": iso(p.last_refreshed),
        "created_at": iso(p.created_at),
    }


def _apply_details(place: FavoritePlace, detail: dict) -> None:
    place.name = (detail.get("displayName") or {}).get("text") or place.name
    place.address = detail.get("formattedAddress") or place.address
    place.maps_url = detail.get("googleMapsUri") or place.maps_url
    place.business_status = detail.get("businessStatus", "")
    hours = detail.get("regularOpeningHours")
    place.opening_hours_json = json.dumps(hours, ensure_ascii=False) if hours else ""
    place.utc_offset_minutes = detail.get("utcOffsetMinutes")
    place.last_refreshed = datetime.utcnow()


@bp.get("/api/places")
def list_places():
    with db_session() as db:
        places = db.scalars(select(FavoritePlace).order_by(FavoritePlace.name)).all()
        return jsonify(
            {
                "google_configured": bool(GOOGLE_MAPS_API_KEY),
                "refresh_days": PLACES_REFRESH_DAYS,
                "places": [_place_json(p) for p in places],
            }
        )


@bp.get("/api/places/search")
def search():
    query = (request.args.get("q") or "").strip()
    if not query:
        return jsonify({"detail": "q required"}), 400
    try:
        return jsonify(search_places(query))
    except ApiError as e:
        return jsonify({"detail": e.detail}), e.code


@bp.post("/api/places")
def add_place():
    body = request.get_json(force=True) or {}
    place_id = (body.get("place_id") or "").strip()
    if not place_id:
        return jsonify({"detail": "place_id required"}), 400
    with db_session() as db:
        exists = db.scalar(select(FavoritePlace).where(FavoritePlace.place_id == place_id))
        if exists:
            return jsonify({"detail": "此店家已在清單中"}), 409
        try:
            detail = fetch_place_details(place_id)
        except ApiError as e:
            return jsonify({"detail": e.detail}), e.code
        place = FavoritePlace(place_id=place_id, name="")
        _apply_details(place, detail)
        db.add(place)
        db.commit()
        db.refresh(place)
        return jsonify(_place_json(place)), 201


@bp.post("/api/places/<int:fav_id>/refresh")
def refresh_place(fav_id: int):
    with db_session() as db:
        place = db.get(FavoritePlace, fav_id)
        if not place:
            return jsonify({"detail": "Place not found"}), 404
        try:
            detail = fetch_place_details(place.place_id)
        except ApiError as e:
            return jsonify({"detail": e.detail}), e.code
        _apply_details(place, detail)
        db.commit()
        db.refresh(place)
        return jsonify(_place_json(place))


@bp.delete("/api/places/<int:fav_id>")
def delete_place(fav_id: int):
    with db_session() as db:
        place = db.get(FavoritePlace, fav_id)
        if not place:
            return jsonify({"detail": "Place not found"}), 404
        db.delete(place)
        db.commit()
        return "", 204
