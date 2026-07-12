from flask import Blueprint, jsonify, request
from sqlalchemy import select

from app.models import User
from app.routers.common import db_session, iso
from app.services import ApiError, create_user, ensure_modules, get_user_or_404, update_modules

bp = Blueprint("users", __name__)


def _user_json(u: User) -> dict:
    return {"id": u.id, "name": u.name, "created_at": iso(u.created_at)}


@bp.get("/api/users")
def list_users():
    with db_session() as db:
        users = db.scalars(select(User).order_by(User.name)).all()
        return jsonify([_user_json(u) for u in users])


@bp.post("/api/users")
def post_user():
    body = request.get_json(force=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"detail": "Name is required"}), 400
    with db_session() as db:
        try:
            user = create_user(db, name)
            return jsonify(_user_json(user)), 201
        except ApiError as e:
            return jsonify({"detail": e.detail}), e.code


@bp.get("/api/users/<int:user_id>")
def get_user(user_id: int):
    with db_session() as db:
        user = get_user_or_404(db, user_id)
        return jsonify(_user_json(user))


@bp.get("/api/users/<int:user_id>/modules")
def get_modules(user_id: int):
    with db_session() as db:
        user = get_user_or_404(db, user_id)
        mods = ensure_modules(db, user)
        return jsonify(mods)


@bp.patch("/api/users/<int:user_id>/modules")
def patch_modules(user_id: int):
    body = request.get_json(force=True) or {}
    with db_session() as db:
        user = get_user_or_404(db, user_id)
        try:
            mods = update_modules(db, user, body)
            return jsonify(mods)
        except ApiError as e:
            return jsonify({"detail": e.detail}), e.code
