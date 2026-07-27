from datetime import date, datetime, timezone

from sqlmodel import Session, select

from app.core.database import engine
from app.models.appointment import Appointment
from app.models.doctor import Doctor, DoctorAvailability, DoctorLeave


def get_date_slots(doctor_id: int, target_date: str) -> list[str]:
    today_str = date.today().isoformat()
    with Session(engine) as session:
        doctor = session.get(Doctor, doctor_id)
        if not doctor or not doctor.is_active:
            return []

        leave = session.exec(
            select(DoctorLeave).where(
                DoctorLeave.doctor_id == doctor_id, DoctorLeave.leave_date == target_date
            )
        ).first()
        if leave:
            return []

        dt = date.fromisoformat(target_date)
        dow = dt.weekday()

        avail = session.exec(
            select(DoctorAvailability).where(
                DoctorAvailability.doctor_id == doctor_id,
                DoctorAvailability.day_of_week == dow,
                DoctorAvailability.is_active == True,
            )
        ).first()
        if not avail:
            return []

        booked = session.exec(
            select(Appointment).where(
                Appointment.doctor_id == doctor_id,
                Appointment.appointment_date == target_date,
                Appointment.status.not_in(["cancelled", "no_show"]),
            )
        ).all()
        booked_starts = {a.start_time for a in booked}

        slots = []
        start_h, start_m = map(int, avail.start_time.split(":"))
        end_h, end_m = map(int, avail.end_time.split(":"))
        start_min = start_h * 60 + start_m
        end_min = end_h * 60 + end_m
        dur = avail.slot_duration_minutes

        now = datetime.now(timezone.utc)
        current_minutes = now.hour * 60 + now.minute

        for slot_start in range(start_min, end_min, dur):
            h = slot_start // 60
            m = slot_start % 60
            time_str = f"{h:02d}:{m:02d}"

            if target_date == today_str and slot_start <= current_minutes:
                continue
            if time_str in booked_starts:
                continue

            slots.append(time_str)

    return slots


def validate_slot(doctor_id: int, target_date: str, start_time: str) -> bool:
    available = get_date_slots(doctor_id, target_date)
    return start_time in available
