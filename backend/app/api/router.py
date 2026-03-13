from fastapi import APIRouter

from app.api.routes import admin, auth, cases, client, compliance, dashboard, health, lawyer, organizations, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(organizations.router, prefix="/api/v1")
api_router.include_router(users.router, prefix="/api/v1")
api_router.include_router(cases.router, prefix="/api/v1")
api_router.include_router(dashboard.router, prefix="/api/v1")
api_router.include_router(admin.router, prefix="/api/v1")
api_router.include_router(auth.router, prefix="/api/v1")
api_router.include_router(lawyer.router, prefix="/api/v1")
api_router.include_router(client.router, prefix="/api/v1")
api_router.include_router(compliance.router, prefix="/api/v1")
