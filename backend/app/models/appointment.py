from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class Appointment(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    appointment_number: str = Field(unique=True, index=True)
    patient_id: int = Field(foreign_key="patient.id", index=True)
    doctor_id: int = Field(foreign_key="doctor.id", index=True)
    appointment_date: str  # "YYYY-MM-DD"
    start_time: str  # "09:00"
    end_time: str  # "09:20"
    reason: str = ""
    status: str = "booked"  # booked, confirmed, checked_in, completed, cancelled, no_show
    booking_source: str = "whatsapp"  # whatsapp, staff
    reminder_sent_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ClinicSettings(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    clinic_name: str = "OnePilot Clinic"
    address: str = ""
    phone: str = ""
    whatsapp_number: str = ""
    opening_hours: str = "Mon-Sat 9:00 AM - 5:00 PM"
    appointment_reminder_hours: int = 24
    timezone: str = "Asia/Kolkata"
