from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class Doctor(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    speciality: str
    qualification: str = ""
    registration_number: str = ""
    consultation_fee: float = 0.0
    consultation_duration_minutes: int = 20
    languages: str = ""
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DoctorAvailability(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    doctor_id: int = Field(foreign_key="doctor.id", index=True)
    day_of_week: int  # 0=Mon ... 6=Sun
    start_time: str  # "09:00"
    end_time: str  # "17:00"
    slot_duration_minutes: int = 20
    is_active: bool = True


class DoctorLeave(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    doctor_id: int = Field(foreign_key="doctor.id", index=True)
    leave_date: str  # "YYYY-MM-DD"
    reason: str = ""
