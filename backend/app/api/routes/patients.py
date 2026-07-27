from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, desc
from app.core.database import get_session
from app.core.auth import get_current_user
from app.core.normalize import normalize_phone
from app.models.user import User
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.doctor import Doctor

router = APIRouter(prefix="/patients", tags=["patients"])


class PatientCreate(BaseModel):
    phone: str
    name: str = ""
    age: int | None = None
    gender: str = ""
    preferred_language: str = ""


class PatientUpdate(BaseModel):
    name: str | None = None
    age: int | None = None
    gender: str | None = None
    preferred_language: str | None = None


@router.get("")
def list_patients(
    query: str | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    q = select(Patient).order_by(desc(Patient.created_at))
    if query:
        like = f"%{query}%"
        q = q.where(
            Patient.name.ilike(like) | Patient.phone.ilike(like)
        )
    patients = session.exec(q).all()
    return patients


@router.post("")
def create_patient(
    body: PatientCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    phone = normalize_phone(body.phone)
    existing = session.exec(select(Patient).where(Patient.phone == phone)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Patient with this phone already exists")
    patient = Patient(phone=phone, name=body.name, age=body.age, gender=body.gender, preferred_language=body.preferred_language)
    session.add(patient)
    session.commit()
    session.refresh(patient)
    return patient


@router.get("/{patient_id}")
def get_patient(patient_id: int, session: Session = Depends(get_session)):
    patient = session.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    appointments = session.exec(
        select(Appointment).where(Appointment.patient_id == patient_id)
    ).all()
    total_appointments = len(appointments)
    upcoming = [a for a in appointments if a.status not in ("cancelled", "no_show", "completed")]
    upcoming_count = len(upcoming)

    last_appointment_date = None
    if appointments:
        sorted_appts = sorted(appointments, key=lambda a: a.appointment_date + "T" + a.start_time, reverse=True)
        last_appointment_date = sorted_appts[0].appointment_date

    next_appointment = None
    if upcoming:
        earliest = min(upcoming, key=lambda a: a.appointment_date + "T" + a.start_time)
        doctor = session.get(Doctor, earliest.doctor_id)
        next_appointment = {
            "id": earliest.id,
            "doctor_name": doctor.name if doctor else "",
            "doctor_speciality": doctor.speciality if doctor else "",
            "appointment_date": earliest.appointment_date,
            "start_time": earliest.start_time,
            "status": earliest.status,
        }

    return {
        "id": patient.id,
        "name": patient.name,
        "phone": patient.phone,
        "age": patient.age,
        "gender": patient.gender,
        "preferred_language": patient.preferred_language,
        "created_at": patient.created_at.isoformat(),
        "total_appointments": total_appointments,
        "upcoming_count": upcoming_count,
        "last_appointment_date": last_appointment_date,
        "next_appointment": next_appointment,
    }


@router.patch("/{patient_id}")
def update_patient(
    patient_id: int,
    body: PatientUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    patient = session.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)
    session.commit()
    session.refresh(patient)
    return patient


@router.get("/{patient_id}/appointments")
def list_patient_appointments(
    patient_id: int,
    session: Session = Depends(get_session),
):
    patient = session.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    appts = session.exec(
        select(Appointment)
        .where(Appointment.patient_id == patient_id)
        .order_by(desc(Appointment.appointment_date), desc(Appointment.start_time))
    ).all()
    result = []
    for a in appts:
        doctor = session.get(Doctor, a.doctor_id)
        result.append({
            "appointment_number": a.appointment_number,
            "created_at": a.created_at.isoformat(),
            "appointment_date": a.appointment_date,
            "start_time": a.start_time,
            "doctor_id": a.doctor_id,
            "doctor_name": doctor.name if doctor else "",
            "doctor_speciality": doctor.speciality if doctor else "",
            "reason": a.reason,
            "booking_source": a.booking_source,
            "status": a.status,
        })
    return result
