import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import require_user_id
from app.models.profile import BasicProfile
from app.services.profile_repository import ProfileRepository


router = APIRouter(prefix="/api", tags=["profile"])
logger = logging.getLogger(__name__)


def get_profile_repository() -> ProfileRepository:
    return ProfileRepository()


@router.get("/profile", response_model=BasicProfile | None)
async def get_profile(
    user_id: Annotated[str, Depends(require_user_id)],
    repository: Annotated[ProfileRepository, Depends(get_profile_repository)],
) -> BasicProfile | None:
    try:
        profile = repository.get_by_user(user_id)
    except Exception as exc:
        logger.error("profile_read_failed", extra={"error_type": type(exc).__name__})
        raise _storage_error("profile_read_failed", "No se pudo cargar el perfil") from exc
    return BasicProfile.model_validate(profile) if profile is not None else None


@router.put("/profile", response_model=BasicProfile)
async def save_profile(
    payload: BasicProfile,
    user_id: Annotated[str, Depends(require_user_id)],
    repository: Annotated[ProfileRepository, Depends(get_profile_repository)],
) -> BasicProfile:
    try:
        saved_profile = repository.upsert(user_id, payload.model_dump())
    except Exception as exc:
        logger.error("profile_write_failed", extra={"error_type": type(exc).__name__})
        raise _storage_error("profile_write_failed", "No se pudo guardar el perfil") from exc
    return BasicProfile.model_validate(saved_profile)


def _storage_error(error_code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={"code": error_code, "message": message},
    )