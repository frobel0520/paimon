from flask import Blueprint, jsonify, request
from sqlalchemy import select

from app.models import Note
from app.routers.common import db_session, iso
from app.services import get_user_or_404, touch_note

bp = Blueprint("notes", __name__)


def _note_json(n: Note) -> dict:
    return {
        "id": n.id,
        "title": n.title,
        "content": n.content,
        "completed": n.completed,
        "created_at": iso(n.created_at),
        "updated_at": iso(n.updated_at),
    }


@bp.get("/api/users/<int:user_id>/notes")
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


@bp.post("/api/users/<int:user_id>/notes")
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


@bp.patch("/api/users/<int:user_id>/notes/<int:note_id>")
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


@bp.delete("/api/users/<int:user_id>/notes/<int:note_id>")
def delete_note(user_id: int, note_id: int):
    with db_session() as db:
        get_user_or_404(db, user_id)
        note = db.get(Note, note_id)
        if not note or note.user_id != user_id:
            return jsonify({"detail": "Note not found"}), 404
        db.delete(note)
        db.commit()
        return "", 204
