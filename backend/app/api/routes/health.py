from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/")
def root_health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
