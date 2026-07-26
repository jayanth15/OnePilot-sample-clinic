from sqlmodel import Session, select

from app.core.database import engine, init_db
from app.core.security import hash_password
from app.models.user import User


def seed() -> None:
    init_db()
    with Session(engine) as session:
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
        session.commit()
        print("Seeded platform admin: admin@onecorestack.com / password")


if __name__ == "__main__":
    seed()
