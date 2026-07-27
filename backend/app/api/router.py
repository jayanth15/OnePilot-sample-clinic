from fastapi import APIRouter

from app.api.routes import (
    agent,
    appointments,
    auth,
    clinic_settings,
    contacts,
    doctors,
    health,
    patients,
    settings,
    webhooks,
    workflows,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(agent.router)
api_router.include_router(contacts.router)
api_router.include_router(settings.router)
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["workflows"])
api_router.include_router(doctors.router)
api_router.include_router(patients.router)
api_router.include_router(appointments.router)
api_router.include_router(clinic_settings.router)
