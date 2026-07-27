from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.auth import get_current_user
from app.models.user import User
from app.models.doctor import Doctor, DoctorAvailability, DoctorLeave
from app.services.availability import get_date_slots

router = APIRouter(prefix="/doctors", tags=["doctors"])


class DoctorCreate(BaseModel):
    name: str
    speciality: str
    qualification: str = ""
    registration_number: str = ""
    consultation_fee: float = 0.0
    consultation_duration_minutes: int = 20
    languages: str = ""
    is_active: bool = True


class DoctorUpdate(BaseModel):
    name: str | None = None
    speciality: str | None = None
    qualification: str | None = None
    registration_number: str | None = None
    consultation_fee: float | None = None
    consultation_duration_minutes: int | None = None
    languages: str | None = None
    is_active: bool | None = None


class AvailabilitySlot(BaseModel):
    day_of_week: int
    start_time: str
    end_time: str
    slot_duration_minutes: int = 20
    is_active: bool = True


class LeaveCreate(BaseModel):
    leave_date: str
    reason: str = ""


@router.get("")
def list_doctors(
    speciality: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    session: Session = Depends(get_session),
):
    query = select(Doctor)
    if speciality:
        query = query.where(Doctor.speciality == speciality)
    if is_active is not None:
        query = query.where(Doctor.is_active == is_active)
    doctors = session.exec(query).all()
    return doctors


@router.post("")
def create_doctor(
    body: DoctorCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    doctor = Doctor(**body.model_dump())
    session.add(doctor)
    session.commit()
    session.refresh(doctor)
    return doctor


@router.get("/{doctor_id}")
def get_doctor(doctor_id: int, session: Session = Depends(get_session)):
    doctor = session.get(Doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doctor


@router.patch("/{doctor_id}")
def update_doctor(
    doctor_id: int,
    body: DoctorUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    doctor = session.get(Doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(doctor, field, value)
    session.commit()
    session.refresh(doctor)
    return doctor


@router.get("/{doctor_id}/availability")
def get_availability(doctor_id: int, session: Session = Depends(get_session)):
    doctor = session.get(Doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    rows = session.exec(
        select(DoctorAvailability).where(DoctorAvailability.doctor_id == doctor_id)
    ).all()
    return rows


@router.put("/{doctor_id}/availability")
def set_availability(
    doctor_id: int,
    body: list[AvailabilitySlot],
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    doctor = session.get(Doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    existing = session.exec(
        select(DoctorAvailability).where(DoctorAvailability.doctor_id == doctor_id)
    ).all()
    for row in existing:
        session.delete(row)
    for item in body:
        slot = DoctorAvailability(doctor_id=doctor_id, **item.model_dump())
        session.add(slot)
    session.commit()
    return session.exec(
        select(DoctorAvailability).where(DoctorAvailability.doctor_id == doctor_id)
    ).all()


@router.post("/{doctor_id}/leave")
def add_leave(
    doctor_id: int,
    body: LeaveCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    doctor = session.get(Doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    leave = DoctorLeave(doctor_id=doctor_id, **body.model_dump())
    session.add(leave)
    session.commit()
    session.refresh(leave)
    return leave


@router.delete("/{doctor_id}/leave/{leave_id}")
def remove_leave(
    doctor_id: int,
    leave_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    leave = session.get(DoctorLeave, leave_id)
    if not leave or leave.doctor_id != doctor_id:
        raise HTTPException(status_code=404, detail="Leave entry not found")
    session.delete(leave)
    session.commit()
    return {"ok": True}


@router.get("/{doctor_id}/slots")
def get_slots(
    doctor_id: int,
    date: str = Query(),
    session: Session = Depends(get_session),
):
    doctor = session.get(Doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    slots = get_date_slots(doctor_id, date)
    return {"doctor_id": doctor_id, "date": date, "timezone": "Asia/Kolkata", "slots": slots}
