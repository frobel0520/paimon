from datetime import datetime

from sqlalchemy import DateTime, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FavoritePlace(Base):
    """常去的飲食店家，快取 Google Places 的營業時間等資料。"""

    __tablename__ = "favorite_places"
    __table_args__ = (UniqueConstraint("place_id", name="uq_place"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    place_id: Mapped[str] = mapped_column(String(255))  # Google Place ID
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str] = mapped_column(String(500), default="")
    maps_url: Mapped[str] = mapped_column(String(500), default="")
    business_status: Mapped[str] = mapped_column(String(40), default="")
    opening_hours_json: Mapped[str] = mapped_column(Text, default="")  # regularOpeningHours 原始 JSON
    utc_offset_minutes: Mapped[int | None] = mapped_column(nullable=True)
    last_refreshed: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
