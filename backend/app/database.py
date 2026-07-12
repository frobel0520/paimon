import shutil
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DB_PATH = Path(__file__).resolve().parent.parent / "paimon.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

_LEGACY_TABLES = ("users", "user_modules", "notes", "wheel_options", "meal_entries")


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    _migrate_legacy()
    Base.metadata.create_all(bind=engine)


def _migrate_legacy() -> None:
    """一次性遷移：移除多使用者時代的資料表，favorite_places 去掉 user_id。

    執行前會把整個 DB 備份成 paimon.db.bak（含舊的記事、飲食紀錄）。
    各使用者的店家收藏會合併保留（同一家店只留一筆）。
    """
    if not DB_PATH.exists():
        return
    insp = inspect(engine)
    tables = insp.get_table_names()
    fav_cols = (
        [c["name"] for c in insp.get_columns("favorite_places")]
        if "favorite_places" in tables
        else []
    )
    has_legacy_tables = any(t in tables for t in _LEGACY_TABLES)
    has_legacy_fav = "user_id" in fav_cols
    if not has_legacy_tables and not has_legacy_fav:
        return

    shutil.copy(DB_PATH, DB_PATH.parent / (DB_PATH.name + ".bak"))

    with engine.begin() as conn:
        if has_legacy_fav:
            conn.execute(text("ALTER TABLE favorite_places RENAME TO favorite_places_legacy"))
        for t in _LEGACY_TABLES:
            conn.execute(text(f"DROP TABLE IF EXISTS {t}"))

    Base.metadata.create_all(bind=engine)

    if has_legacy_fav:
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO favorite_places
                        (place_id, name, address, maps_url, business_status,
                         opening_hours_json, utc_offset_minutes, last_refreshed, created_at)
                    SELECT place_id, name, address, maps_url, business_status,
                           opening_hours_json, utc_offset_minutes, last_refreshed, created_at
                    FROM favorite_places_legacy
                    GROUP BY place_id
                    """
                )
            )
            conn.execute(text("DROP TABLE favorite_places_legacy"))
