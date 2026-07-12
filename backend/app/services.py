import random
from datetime import datetime

from sqlalchemy.orm import Session


class ApiError(Exception):
    def __init__(self, code: int, detail: str):
        self.code = code
        self.detail = detail
        super().__init__(detail)

from app.models import MODULE_KEYS, SPRINT2_MODULES, MealEntry, Note, User, UserModule, WheelOption

DEFAULT_MODULES = {
    "diet": True,
    "places": True,
    "games": False,
    "notes": True,
    "work": False,
}

DEFAULT_FOOD = ["滷肉飯", "牛肉麵", "便當", "水餃", "披薩"]
DEFAULT_DRINK = ["手搖茶", "咖啡", "可樂", "氣泡水", "豆漿"]


def get_user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user:
        raise ApiError(404, "User not found")
    return user


def ensure_modules(db: Session, user: User) -> dict[str, bool]:
    existing = {m.module_key: m.enabled for m in user.modules}
    changed = False
    for key in MODULE_KEYS:
        if key not in existing:
            enabled = DEFAULT_MODULES[key]
            db.add(UserModule(user_id=user.id, module_key=key, enabled=enabled))
            existing[key] = enabled
            changed = True
    if changed:
        db.commit()
        db.refresh(user)
    return {key: existing[key] for key in MODULE_KEYS}


def create_user(db: Session, name: str) -> User:
    name = name.strip()
    if not name:
        raise ApiError(400, "Name is required")
    if db.query(User).filter(User.name == name).first():
        raise ApiError(409, "Profile name already exists")
    user = User(name=name)
    db.add(user)
    db.flush()
    for key in MODULE_KEYS:
        db.add(UserModule(user_id=user.id, module_key=key, enabled=DEFAULT_MODULES[key]))
    for label in DEFAULT_FOOD:
        db.add(WheelOption(user_id=user.id, wheel_type="food", label=label))
    for label in DEFAULT_DRINK:
        db.add(WheelOption(user_id=user.id, wheel_type="drink", label=label))
    db.commit()
    db.refresh(user)
    return user


def update_modules(db: Session, user: User, payload: dict[str, bool | None]) -> dict[str, bool]:
    ensure_modules(db, user)
    for key, value in payload.items():
        if value is None:
            continue
        if key in SPRINT2_MODULES and value:
            raise ApiError(400, f"Module '{key}' is not available until Sprint 2")
        mod = next((m for m in user.modules if m.module_key == key), None)
        if mod:
            mod.enabled = value
    db.commit()
    db.refresh(user)
    return ensure_modules(db, user)


def spin_wheel(db: Session, user_id: int, wheel_type: str) -> str:
    options = (
        db.query(WheelOption)
        .filter(WheelOption.user_id == user_id, WheelOption.wheel_type == wheel_type)
        .all()
    )
    if not options:
        raise ApiError(400, "Add at least one option before spinning")
    return random.choice(options).label


def touch_note(note: Note) -> None:
    note.updated_at = datetime.utcnow()
