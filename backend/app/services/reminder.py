import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlmodel import Session, select

from app.core.database import engine
from app.models.appointment import Appointment, ClinicSettings
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.messaging.gupshup import gupshup_client
from app.messaging.templates import reminder_msg

logger = logging.getLogger(__name__)


async def start_reminder_sweep(interval_seconds: int = 60) -> None:
    logger.info("Reminder sweep started (interval=%ss)", interval_seconds)
    while True:
        try:
            await _sweep()
        except Exception:
            logger.exception("Reminder sweep failed")
        await asyncio.sleep(interval_seconds)


async def _sweep() -> None:
    with Session(engine) as session:
        settings = session.exec(select(ClinicSettings)).first()
        if not settings:
            return

        reminder_hours = settings.appointment_reminder_hours
        now = datetime.now(timezone.utc)
        target = now + timedelta(hours=reminder_hours)
        target_date = target.strftime("%Y-%m-%d")

        appointments = session.exec(
            select(Appointment).where(
                Appointment.appointment_date == target_date,
                Appointment.status.in_(["booked", "confirmed"]),
                Appointment.reminder_sent_at.is_(None),
            )
        ).all()

        for apt in appointments:
            patient = session.get(Patient, apt.patient_id)
            doctor = session.get(Doctor, apt.doctor_id)
            if not patient or not patient.phone or not doctor:
                continue

            msg = reminder_msg(apt, doctor)
            try:
                await gupshup_client.send_text(patient.phone, msg)
                apt.reminder_sent_at = datetime.now(timezone.utc)
                session.add(apt)
                logger.info("Reminder sent for appointment %s to %s", apt.appointment_number, patient.phone)
            except Exception:
                logger.exception("Failed to send reminder for appointment %s", apt.appointment_number)

        session.commit()

        if appointments:
            logger.info("Sent %d reminder(s)", len(appointments))
