import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import require_user_id
from app.models.trajectory_assistance import AssistanceResult, AssistanceTurnRequest
from app.services.azure_openai import AzureOpenAIError
from app.services.trajectory_assistance import InvalidAssistanceResultError, TrajectoryAssistanceService


router = APIRouter(prefix="/api", tags=["trajectory-assistance"])
logger = logging.getLogger(__name__)


def get_assistance_service() -> TrajectoryAssistanceService:
    return TrajectoryAssistanceService()


@router.post("/trajectory-assistance/turn", response_model=AssistanceResult)
async def assistance_turn(
    payload: AssistanceTurnRequest,
    user_id: Annotated[str, Depends(require_user_id)],
    service: Annotated[TrajectoryAssistanceService, Depends(get_assistance_service)],
) -> AssistanceResult:
    try:
        return await service.assist(user_id, payload)
    except InvalidAssistanceResultError:
        raise _error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "invalid_assistance_response",
            "La respuesta de asistencia no es válida",
        )
    except AzureOpenAIError:
        raise _error(
            status.HTTP_502_BAD_GATEWAY,
            "provider_unavailable",
            "El servicio de asistencia no está disponible",
        )
    except Exception as exc:
        logger.error("trajectory_assistance_failed", extra={"error_type": type(exc).__name__})
        raise _error(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "assistance_failed",
            "No se pudo completar la asistencia",
        ) from exc


def _error(code: int, error_code: str, message: str) -> HTTPException:
    return HTTPException(status_code=code, detail={"code": error_code, "message": message})