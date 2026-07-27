from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, desc
from datetime import date, datetime
from app.core.database import get_session
from app.core.auth import get_current_user
from app.core.normalize import normalize_phone
from app.models.user import User
from app.models.patient import Patient
from app.models.doctor import Doctor, DoctorLeave
from app.models.appointment import Appointment, ClinicSettings
from app.services.availability import validate_slot
from app.messaging.gupshup import gupshup_client
from app.messaging.templates import (
    appointment_booked_msg,
    appointment_cancelled_msg,
    appointment_rescheduled_msg,
)

router = APIRouter(prefix="/appointments", tags=["appointments"])

CANCELLED_OR_NOSHOW = ("cancelled", "no_show")


class AppointmentCreate(BaseModel):
    patient_id: int
    doctor_id: int
    appointment_date: str
    start_time: str
    reason: str = ""
    booking_source: str = "staff"


class AppointmentReschedule(BaseModel):
    appointment_date: str
    start_time: str


def _generate_appointment_number(session: Session, apt_date: str) -> str:
    prefix = f"APT-{apt_date.replace('-', '')}-"
    existing = session.exec(
        select(Appointment).where(Appointment.appointment_number.like(f"{prefix}%"))
    ).all()
    seq = len(existing) + 1
    return f"{prefix}{seq:04d}"


def _get_doctor_name(d: Doctor | None) -> str:
    return d.name if d else ""


def _get_doctor_speciality(d: Doctor | None) -> str:
    return d.speciality if d else ""


def _get_patient_name(p: Patient | None) -> str:
    return p.name if p else ""


def _get_patient_phone(p: Patient | None) -> str:
    return p.phone if p else ""


@router.get("")
def list_appointments(
    date: str | None = Query(default=None, alias="date"),
    doctor_id: int | None = Query(default=None),
    patient_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    booking_source: str | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    q = select(Appointment).order_by(desc(Appointment.appointment_date), desc(Appointment.start_time))
    if date:
        q = q.where(Appointment.appointment_date == date)
    if doctor_id:
        q = q.where(Appointment.doctor_id == doctor_id)
    if patient_id:
        q = q.where(Appointment.patient_id == patient_id)
    if status:
        q = q.where(Appointment.status == status)
    if booking_source:
        q = q.where(Appointment.booking_source == booking_source)
    appts = session.exec(q).all()
    result = []
    for a in appts:
        patient = session.get(Patient, a.patient_id)
        doctor = session.get(Doctor, a.doctor_id)
        result.append({
            "id": a.id,
            "appointment_number": a.appointment_number,
            "appointment_date": a.appointment_date,
            "start_time": a.start_time,
            "end_time": a.end_time,
            "reason": a.reason,
            "status": a.status,
            "booking_source": a.booking_source,
            "created_at": a.created_at.isoformat(),
            "patient_name": _get_patient_name(patient),
            "patient_phone": _get_patient_phone(patient),
            "doctor_name": _get_doctor_name(doctor),
            "doctor_speciality": _get_doctor_speciality(doctor),
        })
    return result


@router.post("")
async def book_appointment(
    body: AppointmentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    patient = session.get(Patient, body.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    doctor = session.get(Doctor, body.doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if not doctor.is_active:
        raise HTTPException(status_code=400, detail="Doctor is not active")

    if body.appointment_date < date.today().isoformat():
        raise HTTPException(status_code=400, detail="Cannot book appointment in the past")

    if not validate_slot(body.doctor_id, body.appointment_date, body.start_time):
        raise HTTPException(status_code=400, detail="Selected slot is not available")

    existing_appt = session.exec(
        select(Appointment).where(
            Appointment.patient_id == body.patient_id,
            Appointment.appointment_date == body.appointment_date,
            Appointment.start_time == body.start_time,
            Appointment.status.not_in(CANCELLED_OR_NOSHOW),
        )
    ).first()
    if existing_appt:
        raise HTTPException(status_code=409, detail="Patient already has an appointment at this time")

    end_h, end_m = map(int, body.start_time.split(":"))
    end_min = end_h * 60 + end_m + doctor.consultation_duration_minutes
    end_time = f"{end_min // 60:02d}:{end_min % 60:02d}"

    appointment_number = _generate_appointment_number(session, body.appointment_date)

    appointment = Appointment(
        appointment_number=appointment_number,
        patient_id=body.patient_id,
        doctor_id=body.doctor_id,
        appointment_date=body.appointment_date,
        start_time=body.start_time,
        end_time=end_time,
        reason=body.reason,
        booking_source=body.booking_source,
    )
    session.add(appointment)
    session.commit()
    session.refresh(appointment)

    clinic = session.exec(select(ClinicSettings)).first()

    if patient.phone:
        msg = appointment_booked_msg(appointment, patient, doctor, clinic)
        try:
            await gupshup_client.send_text(patient.phone, msg)
        except Exception:
            pass

    return appointment


@router.get("/{appointment_id}")
def get_appointment(
    appointment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    patient = session.get(Patient, appointment.patient_id)
    doctor = session.get(Doctor, appointment.doctor_id)
    return {
        **appointment.model_dump(),
        "patient_name": _get_patient_name(patient),
        "patient_phone": _get_patient_phone(patient),
        "doctor_name": _get_doctor_name(doctor),
        "doctor_speciality": _get_doctor_speciality(doctor),
    }


@router.post("/{appointment_id}/confirm")
async def confirm_appointment(
    appointment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    appointment.status = "confirmed"
    appointment.updated_at = datetime.now()
    session.commit()
    session.refresh(appointment)

    doctor = session.get(Doctor, appointment.doctor_id)
    clinic = session.exec(select(ClinicSettings)).first()
    patient = session.get(Patient, appointment.patient_id)
    if patient and patient.phone:
        from app.messaging.templates import appointment_confirmed_msg
        msg = appointment_confirmed_msg(appointment, patient, doctor, clinic)
        try:
            await gupshup_client.send_text(patient.phone, msg)
        except Exception:
            pass

    return appointment


@router.post("/{appointment_id}/reschedule")
async def reschedule_appointment(
    appointment_id: int,
    body: AppointmentReschedule,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if appointment.status in CANCELLED_OR_NOSHOW:
        raise HTTPException(status_code=400, detail="Cannot reschedule a cancelled or no-show appointment")

    if not validate_slot(appointment.doctor_id, body.appointment_date, body.start_time):
        raise HTTPException(status_code=400, detail="Selected slot is not available")

    doctor = session.get(Doctor, appointment.doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    end_h, end_m = map(int, body.start_time.split(":"))
    end_min = end_h * 60 + end_m + doctor.consultation_duration_minutes
    end_time = f"{end_min // 60:02d}:{end_min % 60:02d}"

    appointment.appointment_date = body.appointment_date
    appointment.start_time = body.start_time
    appointment.end_time = end_time
    appointment.status = "booked"
    appointment.updated_at = datetime.now()
    session.commit()
    session.refresh(appointment)

    clinic = session.exec(select(ClinicSettings)).first()
    patient = session.get(Patient, appointment.patient_id)
    if patient and patient.phone:
        msg = appointment_rescheduled_msg(appointment, doctor, clinic)
        try:
            await gupshup_client.send_text(patient.phone, msg)
        except Exception:
            pass

    return appointment


@router.post("/{appointment_id}/cancel")
async def cancel_appointment(
    appointment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    appointment.status = "cancelled"
    appointment.updated_at = datetime.now()
    session.commit()
    session.refresh(appointment)

    doctor = session.get(Doctor, appointment.doctor_id)
    clinic = session.exec(select(ClinicSettings)).first()
    patient = session.get(Patient, appointment.patient_id)
    if patient and patient.phone:
        msg = appointment_cancelled_msg(appointment, doctor, clinic)
        try:
            await gupshup_client.send_text(patient.phone, msg)
        except Exception:
            pass

    return appointment


@router.post("/{appointment_id}/check-in")
def checkin_appointment(
    appointment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    appointment.status = "checked_in"
    appointment.updated_at = datetime.now()
    session.commit()
    session.refresh(appointment)
    return appointment


@router.post("/{appointment_id}/complete")
def complete_appointment(
    appointment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    appointment.status = "completed"
    appointment.updated_at = datetime.now()
    session.commit()
    session.refresh(appointment)
    return appointment


@router.post("/{appointment_id}/no-show")
def noshow_appointment(
    appointment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    appointment.status = "no_show"
    appointment.updated_at = datetime.now()
    session.commit()
    session.refresh(appointment)
    return appointment
