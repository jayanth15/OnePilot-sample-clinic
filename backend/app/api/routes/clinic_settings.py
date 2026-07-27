from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.auth import get_current_user
from app.models.user import User
from app.models.appointment import ClinicSettings

router = APIRouter(prefix="/clinic-settings", tags=["clinic-settings"])


class ClinicSettingsUpdate(BaseModel):
    clinic_name: str | None = None
    address: str | None = None
    phone: str | None = None
    whatsapp_number: str | None = None
    opening_hours: str | None = None
    appointment_reminder_hours: int | None = None
    timezone: str | None = None


def _get_or_create_settings(session: Session) -> ClinicSettings:
    settings = session.exec(select(ClinicSettings)).first()
    if not settings:
        settings = ClinicSettings()
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


@router.get("")
def get_clinic_settings(session: Session = Depends(get_session)):
    settings = _get_or_create_settings(session)
    return settings


@router.patch("")
def update_clinic_settings(
    body: ClinicSettingsUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    settings = _get_or_create_settings(session)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    session.commit()
    session.refresh(settings)
    return settings
