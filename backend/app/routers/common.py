from datetime import datetime

from app.database import SessionLocal


def db_session():
    return SessionLocal()


def iso(dt: datetime) -> str:
    return dt.isoformat() + "Z"
