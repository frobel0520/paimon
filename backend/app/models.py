from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

MODULE_KEYS = ("diet", "places", "games", "notes", "work")
SPRINT2_MODULES = ("games", "work")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    modules: Mapped[list["UserModule"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    notes: Mapped[list["Note"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    wheel_options: Mapped[list["WheelOption"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    meal_entries: Mapped[list["MealEntry"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    favorite_places: Mapped[list["FavoritePlace"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class UserModule(Base):
    __tablename__ = "user_modules"
    __table_args__ = (UniqueConstraint("user_id", "module_key", name="uq_user_module"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    module_key: Mapped[str] = mapped_column(String(32))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship(back_populates="modules")


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="notes")


class WheelOption(Base):
    __tablename__ = "wheel_options"
    __table_args__ = (UniqueConstraint("user_id", "wheel_type", "label", name="uq_wheel_label"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    wheel_type: Mapped[str] = mapped_column(String(16))  # food | drink
    label: Mapped[str] = mapped_column(String(120))

    user: Mapped["User"] = relationship(back_populates="wheel_options")


class FavoritePlace(Base):
    """常去的飲食店家，快取 Google Places 的營業時間等資料。"""

    __tablename__ = "favorite_places"
    __table_args__ = (UniqueConstraint("user_id", "place_id", name="uq_user_place"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    place_id: Mapped[str] = mapped_column(String(255))  # Google Place ID
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str] = mapped_column(String(500), default="")
    maps_url: Mapped[str] = mapped_column(String(500), default="")
    business_status: Mapped[str] = mapped_column(String(40), default="")
    opening_hours_json: Mapped[str] = mapped_column(Text, default="")  # regularOpeningHours 原始 JSON
    utc_offset_minutes: Mapped[int | None] = mapped_column(nullable=True)
    last_refreshed: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="favorite_places")


class MealEntry(Base):
    __tablename__ = "meal_entries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(String(500))
    eaten_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="meal_entries")
