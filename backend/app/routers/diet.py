from datetime import datetime

from flask import Blueprint, jsonify, request
from sqlalchemy import select

from app.models import MealEntry, WheelOption
from app.routers.common import db_session, iso
from app.services import ApiError, get_user_or_404, spin_wheel

bp = Blueprint("diet", __name__)


def _meal_json(m: MealEntry) -> dict:
    return {"id": m.id, "text": m.text, "eaten_at": iso(m.eaten_at)}


@bp.get("/api/users/<int:user_id>/diet/wheels/<wheel_type>/options")
def list_wheel_options(user_id: int, wheel_type: str):
    if wheel_type not in ("food", "drink"):
        return jsonify({"detail": "wheel_type must be food or drink"}), 400
    with db_session() as db:
        get_user_or_404(db, user_id)
        opts = db.scalars(
            select(WheelOption)
            .where(WheelOption.user_id == user_id, WheelOption.wheel_type == wheel_type)
            .order_by(WheelOption.id)
        ).all()
        return jsonify([{"id": o.id, "label": o.label} for o in opts])


@bp.post("/api/users/<int:user_id>/diet/wheels/<wheel_type>/options")
def add_wheel_option(user_id: int, wheel_type: str):
    if wheel_type not in ("food", "drink"):
        return jsonify({"detail": "wheel_type must be food or drink"}), 400
    body = request.get_json(force=True) or {}
    label = (body.get("label") or "").strip()
    if not label:
        return jsonify({"detail": "label required"}), 400
    with db_session() as db:
        get_user_or_404(db, user_id)
        exists = db.scalar(
            select(WheelOption).where(
                WheelOption.user_id == user_id,
                WheelOption.wheel_type == wheel_type,
                WheelOption.label == label,
            )
        )
        if exists:
            return jsonify({"detail": "Option already exists"}), 409
        opt = WheelOption(user_id=user_id, wheel_type=wheel_type, label=label)
        db.add(opt)
        db.commit()
        db.refresh(opt)
        return jsonify({"id": opt.id, "label": opt.label}), 201


@bp.delete("/api/users/<int:user_id>/diet/wheels/<wheel_type>/options/<int:option_id>")
def delete_wheel_option(user_id: int, wheel_type: str, option_id: int):
    with db_session() as db:
        get_user_or_404(db, user_id)
        opt = db.get(WheelOption, option_id)
        if not opt or opt.user_id != user_id or opt.wheel_type != wheel_type:
            return jsonify({"detail": "Option not found"}), 404
        db.delete(opt)
        db.commit()
        return "", 204


@bp.post("/api/users/<int:user_id>/diet/wheels/<wheel_type>/spin")
def spin(user_id: int, wheel_type: str):
    if wheel_type not in ("food", "drink"):
        return jsonify({"detail": "wheel_type must be food or drink"}), 400
    with db_session() as db:
        get_user_or_404(db, user_id)
        try:
            label = spin_wheel(db, user_id, wheel_type)
            return jsonify({"label": label})
        except ApiError as e:
            return jsonify({"detail": e.detail}), e.code


@bp.get("/api/users/<int:user_id>/diet/meals")
def list_meals(user_id: int):
    with db_session() as db:
        get_user_or_404(db, user_id)
        meals = db.scalars(
            select(MealEntry)
            .where(MealEntry.user_id == user_id)
            .order_by(MealEntry.eaten_at.desc())
        ).all()
        return jsonify([_meal_json(m) for m in meals])


@bp.post("/api/users/<int:user_id>/diet/meals")
def add_meal(user_id: int):
    body = request.get_json(force=True) or {}
    text = (body.get("text") or "").strip()
    if not text:
        return jsonify({"detail": "text required"}), 400
    with db_session() as db:
        get_user_or_404(db, user_id)
        eaten_at = datetime.utcnow()
        if body.get("eaten_at"):
            eaten_at = datetime.fromisoformat(body["eaten_at"].replace("Z", "+00:00")).replace(
                tzinfo=None
            )
        entry = MealEntry(user_id=user_id, text=text, eaten_at=eaten_at)
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return jsonify(_meal_json(entry)), 201


@bp.delete("/api/users/<int:user_id>/diet/meals/<int:meal_id>")
def delete_meal(user_id: int, meal_id: int):
    with db_session() as db:
        get_user_or_404(db, user_id)
        entry = db.get(MealEntry, meal_id)
        if not entry or entry.user_id != user_id:
            return jsonify({"detail": "Meal not found"}), 404
        db.delete(entry)
        db.commit()
        return "", 204
