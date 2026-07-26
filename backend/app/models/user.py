from uuid import UUID, uuid4

from sqlmodel import SQLModel, Field


class User(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str | None = Field(default=None)
    email: str = Field(index=True, unique=True)
    password_hash: str

    is_platform_admin: bool = Field(default=False)
    is_active: bool = Field(default=True)

    company_id: UUID | None = Field(
        default=None,
        foreign_key="company.id",
        index=True,
    )
