import random
from datetime import datetime

from flask import Flask, jsonify, request
from flask_cors import CORS
from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import MODULE_KEYS, SPRINT2_MODULES, MealEntry, Note, User, UserModule, WheelOption
from app.services import (
    ApiError,
    create_user,
    ensure_modules,
    get_user_or_404,
    spin_wheel,
    touch_note,
    update_modules,
)

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

Base.metadata.create_all(bind=engine)


def db_session():
    return SessionLocal()


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "app": "paimon"})


@app.get("/api/users")
def list_users():
    with db_session() as db:
        users = db.scalars(select(User).order_by(User.name)).all()
        return jsonify([_user_json(u) for u in users])


@app.post("/api/users")
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


@app.get("/api/users/<int:user_id>")
def get_user(user_id: int):
    with db_session() as db:
        user = get_user_or_404(db, user_id)
        return jsonify(_user_json(user))


@app.get("/api/users/<int:user_id>/modules")
def get_modules(user_id: int):
    with db_session() as db:
        user = get_user_or_404(db, user_id)
        mods = ensure_modules(db, user)
        return jsonify(mods)


@app.patch("/api/users/<int:user_id>/modules")
def patch_modules(user_id: int):
    body = request.get_json(force=True) or {}
    with db_session() as db:
        user = get_user_or_404(db, user_id)
        try:
            mods = update_modules(db, user, body)
            return jsonify(mods)
        except ApiError as e:
            return jsonify({"detail": e.detail}), e.code


@app.get("/api/users/<int:user_id>/notes")
def list_notes(user_id: int):
    filt = request.args.get("filter", "all")
    if filt not in ("all", "active", "done"):
        return jsonify({"detail": "invalid filter"}), 400
    with db_session() as db:
        get_user_or_404(db, user_id)
        q = select(Note).where(Note.user_id == user_id)
        if filt == "active":
            q = q.where(Note.completed.is_(False))
        elif filt == "done":
            q = q.where(Note.completed.is_(True))
        notes = db.scalars(q.order_by(Note.updated_at.desc())).all()
        return jsonify([_note_json(n) for n in notes])


@app.post("/api/users/<int:user_id>/notes")
def create_note(user_id: int):
    body = request.get_json(force=True) or {}
    with db_session() as db:
        get_user_or_404(db, user_id)
        note = Note(
            user_id=user_id,
            title=(body.get("title") or "").strip(),
            content=(body.get("content") or "").strip(),
        )
        db.add(note)
        db.commit()
        db.refresh(note)
        return jsonify(_note_json(note)), 201


@app.patch("/api/users/<int:user_id>/notes/<int:note_id>")
def update_note(user_id: int, note_id: int):
    body = request.get_json(force=True) or {}
    with db_session() as db:
        get_user_or_404(db, user_id)
        note = db.get(Note, note_id)
        if not note or note.user_id != user_id:
            return jsonify({"detail": "Note not found"}), 404
        if "title" in body and body["title"] is not None:
            note.title = str(body["title"]).strip()
        if "content" in body and body["content"] is not None:
            note.content = str(body["content"]).strip()
        if "completed" in body and body["completed"] is not None:
            note.completed = bool(body["completed"])
        touch_note(note)
        db.commit()
        db.refresh(note)
        return jsonify(_note_json(note))


@app.delete("/api/users/<int:user_id>/notes/<int:note_id>")
def delete_note(user_id: int, note_id: int):
    with db_session() as db:
        get_user_or_404(db, user_id)
        note = db.get(Note, note_id)
        if not note or note.user_id != user_id:
            return jsonify({"detail": "Note not found"}), 404
        db.delete(note)
        db.commit()
        return "", 204


@app.get("/api/users/<int:user_id>/diet/wheels/<wheel_type>/options")
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


@app.post("/api/users/<int:user_id>/diet/wheels/<wheel_type>/options")
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


@app.delete("/api/users/<int:user_id>/diet/wheels/<wheel_type>/options/<int:option_id>")
def delete_wheel_option(user_id: int, wheel_type: str, option_id: int):
    with db_session() as db:
        get_user_or_404(db, user_id)
        opt = db.get(WheelOption, option_id)
        if not opt or opt.user_id != user_id or opt.wheel_type != wheel_type:
            return jsonify({"detail": "Option not found"}), 404
        db.delete(opt)
        db.commit()
        return "", 204


@app.post("/api/users/<int:user_id>/diet/wheels/<wheel_type>/spin")
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


@app.get("/api/users/<int:user_id>/diet/meals")
def list_meals(user_id: int):
    with db_session() as db:
        get_user_or_404(db, user_id)
        meals = db.scalars(
            select(MealEntry)
            .where(MealEntry.user_id == user_id)
            .order_by(MealEntry.eaten_at.desc())
        ).all()
        return jsonify([_meal_json(m) for m in meals])


@app.post("/api/users/<int:user_id>/diet/meals")
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


@app.delete("/api/users/<int:user_id>/diet/meals/<int:meal_id>")
def delete_meal(user_id: int, meal_id: int):
    with db_session() as db:
        get_user_or_404(db, user_id)
        entry = db.get(MealEntry, meal_id)
        if not entry or entry.user_id != user_id:
            return jsonify({"detail": "Meal not found"}), 404
        db.delete(entry)
        db.commit()
        return "", 204


def _iso(dt: datetime) -> str:
    return dt.isoformat() + "Z"


def _user_json(u: User) -> dict:
    return {"id": u.id, "name": u.name, "created_at": _iso(u.created_at)}


def _note_json(n: Note) -> dict:
    return {
        "id": n.id,
        "title": n.title,
        "content": n.content,
        "completed": n.completed,
        "created_at": _iso(n.created_at),
        "updated_at": _iso(n.updated_at),
    }


def _meal_json(m: MealEntry) -> dict:
    return {"id": m.id, "text": m.text, "eaten_at": _iso(m.eaten_at)}


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)
