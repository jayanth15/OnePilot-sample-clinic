"""Pydantic AI agent for clinic appointment management."""

from datetime import date, datetime

from pydantic_ai import Agent
from pydantic_ai.models import Model
from sqlmodel import Session, select

from app.core.config import settings
from app.core.database import engine
from app.core.normalize import normalize_phone
from app.models.doctor import Doctor, DoctorAvailability
from app.models.patient import Patient
from app.models.appointment import Appointment, ClinicSettings
from app.services.availability import get_date_slots
from app.messaging.templates import (
    appointment_booked_msg,
    appointment_cancelled_msg,
    appointment_rescheduled_msg,
    doctor_unavailable_msg,
    human_handoff_msg,
)
from app.messaging.gupshup import gupshup_client

CANCELLED_OR_NOSHOW = ("cancelled", "no_show")


def _build_model() -> Model | str:
    if settings.agent_model == "test":
        from pydantic_ai.models.test import TestModel
        return TestModel()
    return settings.agent_model


def _generate_appointment_number(session: Session, apt_date: str) -> str:
    prefix = f"APT-{apt_date.replace('-', '')}-"
    existing = session.exec(
        select(Appointment).where(Appointment.appointment_number.like(f"{prefix}%"))
    ).all()
    seq = len(existing) + 1
    return f"{prefix}{seq:04d}"


agent = Agent(
    _build_model(),
    system_prompt=(
        "You are a helpful clinic assistant for OnePilot Clinic. "
        "Keep replies short and WhatsApp-friendly (under 4000 chars). "
        "Dates: support DD-MM-YYYY, 'tomorrow', and weekday names (e.g. 'Monday'). "
        "All times are in IST (Indian Standard Time). "
        "When showing available slots, show at most 5 per reply; ask if they want more. "
        "Guide users with numbered choices and ask ONE question at a time. "
        "ALWAYS confirm before booking, rescheduling, or cancelling an appointment. "
        "Never invent data not returned by your tools. "
        "If the user asks about diagnosis, medicines, prescriptions, or emergencies, "
        "immediately hand off to a human via the request_human_handoff tool."
    ),
)


@agent.tool_plain
async def get_clinic_information() -> str:
    """Get clinic name, address, phone, and opening hours."""
    with Session(engine) as session:
        settings = session.exec(select(ClinicSettings)).first()
        if not settings:
            return "No clinic information found."
        return (
            f"*{settings.clinic_name}*\n"
            f"Address: {settings.address}\n"
            f"Phone: {settings.phone}\n"
            f"Hours: {settings.opening_hours}\n"
            f"Timezone: {settings.timezone}"
        )


@agent.tool_plain
async def list_doctors(speciality: str = "") -> str:
    """List active doctors, optionally filtered by speciality."""
    with Session(engine) as session:
        q = select(Doctor).where(Doctor.is_active == True)
        if speciality:
            q = q.where(Doctor.speciality.ilike(f"%{speciality}%"))
        doctors = session.exec(q).all()
        if not doctors:
            return "No doctors found."
        lines = ["*Available Doctors:*"]
        for d in doctors:
            lines.append(
                f"  {d.id}. Dr. {d.name} — {d.speciality}"
                + (f" ({d.languages})" if d.languages else "")
            )
        return "\n".join(lines)


@agent.tool_plain
async def get_doctor_slots(doctor_id: int, target_date: str) -> str:
    """Get available appointment slots for a doctor on a given date.
    target_date can be a YYYY-MM-DD string, 'tomorrow', or a weekday name.
    Use list_doctors first to get doctor IDs.
    """
    resolved = _resolve_date(target_date)
    if not resolved:
        return "Could not understand the date. Please use DD-MM-YYYY or 'tomorrow'."

    slots = get_date_slots(doctor_id, resolved)
    if not slots:
        with Session(engine) as session:
            doctor = session.get(Doctor, doctor_id)
            doctor_name = doctor.name if doctor else "Unknown"

            avail_rows = session.exec(
                select(DoctorAvailability).where(
                    DoctorAvailability.doctor_id == doctor_id,
                    DoctorAvailability.is_active == True,
                )
            ).all()
            day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            alternate_days = [day_names[a.day_of_week] for a in avail_rows if a.is_active]
            alt_text = ""
            if alternate_days:
                alt_text = f" Available days: {', '.join(alternate_days)}."

        return doctor_unavailable_msg(doctor_name, resolved) + alt_text

    display = "\n".join(f"  {i+1}. {_fmt_time(s)}" for i, s in enumerate(slots[:5]))
    result = f"*Available slots for {resolved}:*\n{display}"
    if len(slots) > 5:
        result += f"\n... and {len(slots) - 5} more. Reply with a number or say 'show more'."
    return result


@agent.tool_plain
async def find_patient_by_phone(phone: str) -> str:
    """Find a patient by phone number. Returns patient info or 'not found'."""
    normalized = normalize_phone(phone)
    with Session(engine) as session:
        patient = session.exec(select(Patient).where(Patient.phone == normalized)).first()
        if not patient:
            return "Patient not found."
        return (
            f"Patient ID: {patient.id}\n"
            f"Name: {patient.name}\n"
            f"Phone: {patient.phone}\n"
            f"Age: {patient.age or 'N/A'}\n"
            f"Gender: {patient.gender or 'N/A'}"
        )


@agent.tool_plain
async def create_patient(phone: str, name: str, age: int, gender: str) -> str:
    """Create a new patient record. Returns the patient ID."""
    normalized = normalize_phone(phone)
    with Session(engine) as session:
        existing = session.exec(select(Patient).where(Patient.phone == normalized)).first()
        if existing:
            return f"Patient already exists with ID {existing.id}: {existing.name}"
        patient = Patient(phone=normalized, name=name, age=age, gender=gender)
        session.add(patient)
        session.commit()
        session.refresh(patient)
        return f"Patient created with ID {patient.id}. Name: {patient.name}"


@agent.tool_plain
async def book_appointment(
    patient_id: int,
    doctor_id: int,
    appointment_date: str,
    start_time: str,
    reason: str = "",
) -> str:
    """Book an appointment for a patient with a doctor.
    appointment_date must be YYYY-MM-DD.
    Returns booking confirmation or error message. Sends WhatsApp confirmation.
    """
    resolved = _resolve_date(appointment_date) or appointment_date

    with Session(engine) as session:
        patient = session.get(Patient, patient_id)
        if not patient:
            return "Patient not found."

        doctor = session.get(Doctor, doctor_id)
        if not doctor:
            return "Doctor not found."
        if not doctor.is_active:
            return "Doctor is not currently active."

        if not _validate_slot_wrapper(doctor_id, resolved, start_time):
            return f"Slot {_fmt_time(start_time)} on {resolved} is not available."

        end_h, end_m = map(int, start_time.split(":"))
        end_min = end_h * 60 + end_m + doctor.consultation_duration_minutes
        end_time = f"{end_min // 60:02d}:{end_min % 60:02d}"

        appointment_number = _generate_appointment_number(session, resolved)
        appointment = Appointment(
            appointment_number=appointment_number,
            patient_id=patient_id,
            doctor_id=doctor_id,
            appointment_date=resolved,
            start_time=start_time,
            end_time=end_time,
            reason=reason,
            booking_source="whatsapp",
        )
        session.add(appointment)
        session.commit()
        session.refresh(appointment)

        clinic = session.exec(select(ClinicSettings)).first()

        patient_phone = patient.phone
        msg = appointment_booked_msg(appointment, patient, doctor, clinic)

    if patient_phone:
        try:
            await gupshup_client.send_text(patient_phone, msg)
        except Exception:
            pass

    return (
        f"Appointment booked successfully!\n"
        f"Appointment #: {appointment_number}\n"
        f"Doctor: {doctor.name} ({doctor.speciality})\n"
        f"Date: {resolved}\n"
        f"Time: {_fmt_time(start_time)} - {_fmt_time(end_time)}\n"
        f"A confirmation has been sent via WhatsApp."
    )


@agent.tool_plain
async def list_patient_appointments(patient_id: int) -> str:
    """List upcoming (non-cancelled, non-completed) appointments for a patient."""
    with Session(engine) as session:
        patient = session.get(Patient, patient_id)
        if not patient:
            return "Patient not found."

        today = date.today().isoformat()
        appts = session.exec(
            select(Appointment).where(
                Appointment.patient_id == patient_id,
                Appointment.appointment_date >= today,
                Appointment.status.not_in(CANCELLED_OR_NOSHOW),
            ).order_by(Appointment.appointment_date, Appointment.start_time)
        ).all()

        if not appts:
            return "No upcoming appointments found."

        lines = [f"*Upcoming Appointments for {patient.name}:*"]
        for a in appts:
            doctor = session.get(Doctor, a.doctor_id)
            doc_name = doctor.name if doctor else "Unknown"
            lines.append(
                f"  #{a.id}: {a.appointment_date} at {_fmt_time(a.start_time)}"
                f" with Dr. {doc_name} [{a.status}]"
            )
        return "\n".join(lines)


@agent.tool_plain
async def reschedule_appointment(appointment_id: int, new_date: str, new_start_time: str) -> str:
    """Reschedule an existing appointment. new_date must be YYYY-MM-DD.
    Sends WhatsApp notification."""
    resolved = _resolve_date(new_date) or new_date

    with Session(engine) as session:
        appointment = session.get(Appointment, appointment_id)
        if not appointment:
            return "Appointment not found."

        if appointment.status in CANCELLED_OR_NOSHOW:
            return "Cannot reschedule a cancelled or no-show appointment."

        if not _validate_slot_wrapper(appointment.doctor_id, resolved, new_start_time):
            return f"Slot {_fmt_time(new_start_time)} on {resolved} is not available."

        doctor = session.get(Doctor, appointment.doctor_id)
        if not doctor:
            return "Doctor not found."

        end_h, end_m = map(int, new_start_time.split(":"))
        end_min = end_h * 60 + end_m + doctor.consultation_duration_minutes
        end_time = f"{end_min // 60:02d}:{end_min % 60:02d}"

        appointment.appointment_date = resolved
        appointment.start_time = new_start_time
        appointment.end_time = end_time
        appointment.status = "booked"
        session.add(appointment)
        session.commit()
        session.refresh(appointment)

        patient = session.get(Patient, appointment.patient_id)
        clinic = session.exec(select(ClinicSettings)).first()
        patient_phone = patient.phone if patient else ""
        reschedule_msg_text = appointment_rescheduled_msg(appointment, doctor, clinic)

    if patient_phone:
        try:
            await gupshup_client.send_text(patient_phone, reschedule_msg_text)
        except Exception:
            pass

    return (
        f"Appointment #{appointment_id} has been rescheduled to "
        f"{resolved} at {_fmt_time(new_start_time)}. "
        f"A confirmation has been sent via WhatsApp."
    )


@agent.tool_plain
async def cancel_appointment(appointment_id: int) -> str:
    """Cancel an existing appointment. Sends WhatsApp notification."""
    with Session(engine) as session:
        appointment = session.get(Appointment, appointment_id)
        if not appointment:
            return "Appointment not found."

        appointment.status = "cancelled"
        session.add(appointment)
        session.commit()

        patient = session.get(Patient, appointment.patient_id)
        doctor = session.get(Doctor, appointment.doctor_id)
        clinic = session.exec(select(ClinicSettings)).first()
        patient_phone = patient.phone if patient else ""
        cancel_msg_text = appointment_cancelled_msg(appointment, doctor, clinic)

    if patient_phone:
        try:
            await gupshup_client.send_text(patient_phone, cancel_msg_text)
        except Exception:
            pass

    return (
        f"Appointment #{appointment_id} has been cancelled. "
        f"A cancellation notice has been sent via WhatsApp."
    )


@agent.tool_plain
async def request_human_handoff(phone: str) -> str:
    """Request a human representative to contact the patient."""
    normalized = normalize_phone(phone)
    msg = human_handoff_msg()
    try:
        await gupshup_client.send_text(normalized, msg)
    except Exception:
        pass
    return "A human assistant will be in touch with you shortly. Thank you for your patience."


def _resolve_date(date_str: str) -> str | None:
    lower = date_str.strip().lower()
    if lower == "tomorrow":
        from datetime import timedelta
        return (date.today() + timedelta(days=1)).isoformat()
    if lower in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"):
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        today = date.today()
        target_idx = days.index(lower)
        days_ahead = target_idx - today.weekday()
        if days_ahead <= 0:
            days_ahead += 7
        from datetime import timedelta
        return (today + timedelta(days=days_ahead)).isoformat()
    if lower == "today":
        return date.today().isoformat()
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
        return date_str
    except ValueError:
        pass
    try:
        dt = datetime.strptime(date_str, "%d-%m-%Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def _validate_slot_wrapper(doctor_id: int, target_date: str, start_time: str) -> bool:
    slots = get_date_slots(doctor_id, target_date)
    return start_time in slots


def _fmt_time(t: str) -> str:
    try:
        h, m = map(int, t.split(":"))
        period = "AM" if h < 12 else "PM"
        h12 = h if h <= 12 else h - 12
        if h12 == 0:
            h12 = 12
        return f"{h12}:{m:02d} {period}"
    except (ValueError, AttributeError):
        return t
