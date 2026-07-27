from sqlmodel import Session, select

from app.core.database import engine, init_db
from app.core.security import hash_password
from app.models.user import User
from app.models.doctor import Doctor, DoctorAvailability
from app.models.appointment import ClinicSettings


def seed() -> None:
    init_db()
    with Session(engine) as session:
        _seed_admin(session)
        _seed_clinic_settings(session)
        _seed_doctors(session)
        session.commit()
        print("Seeding complete.")


def _seed_admin(session: Session) -> None:
    existing = session.exec(select(User).where(User.email == "admin@onecorestack.com")).first()
    if existing:
        print("Admin user already exists.")
        return
    user = User(
        name="Admin",
        email="admin@onecorestack.com",
        password_hash=hash_password("password"),
        is_platform_admin=True,
    )
    session.add(user)
    print("Seeded platform admin: admin@onecorestack.com / password")


def _seed_clinic_settings(session: Session) -> None:
    existing = session.exec(select(ClinicSettings)).first()
    if existing:
        print("Clinic settings already exist.")
        return
    settings = ClinicSettings(
        clinic_name="OnePilot Clinic",
        address="123 MG Road, Indiranagar, Bengaluru, Karnataka 560038",
        phone="+91-80-41234567",
        whatsapp_number="919999999999",
        opening_hours="Mon-Sat 9:00 AM - 5:00 PM",
        appointment_reminder_hours=24,
        timezone="Asia/Kolkata",
    )
    session.add(settings)
    print("Seeded clinic settings.")


DOCTORS = [
    {
        "name": "Dr. Anjali Rao",
        "speciality": "General Medicine",
        "qualification": "MBBS, MD (Internal Medicine)",
        "registration_number": "KMC-2021-00452",
        "consultation_fee": 500.0,
        "consultation_duration_minutes": 20,
        "languages": "English, Hindi, Kannada",
    },
    {
        "name": "Dr. Sanjay Mehta",
        "speciality": "Paediatrics",
        "qualification": "MBBS, DCH",
        "registration_number": "KMC-2019-00891",
        "consultation_fee": 600.0,
        "consultation_duration_minutes": 20,
        "languages": "English, Hindi, Gujarati",
    },
    {
        "name": "Dr. Priya Sharma",
        "speciality": "Gynaecology",
        "qualification": "MBBS, MS (OBG)",
        "registration_number": "KMC-2020-00337",
        "consultation_fee": 800.0,
        "consultation_duration_minutes": 20,
        "languages": "English, Hindi, Marathi",
    },
]


def _seed_doctors(session: Session) -> None:
    for doc_data in DOCTORS:
        existing = session.exec(
            select(Doctor).where(Doctor.name == doc_data["name"])
        ).first()
        if existing:
            print(f"Doctor '{doc_data['name']}' already exists.")
            continue

        doctor = Doctor(**doc_data)
        session.add(doctor)
        session.flush()
        assert doctor.id is not None

        for dow in range(6):  # Mon=0 ... Sat=5
            avail = DoctorAvailability(
                doctor_id=doctor.id,
                day_of_week=dow,
                start_time="09:00",
                end_time="17:00",
                slot_duration_minutes=20,
                is_active=True,
            )
            session.add(avail)

        print(f"Seeded doctor: {doctor.name} ({doctor.speciality})")


if __name__ == "__main__":
    seed()
