from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class Patient(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = ""
    phone: str = Field(unique=True, index=True)
    age: int | None = Field(default=None)
    gender: str = ""
    preferred_language: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
