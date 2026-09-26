import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.core.auth import require_user_id
from app.models.generate_cv import GenerateCvRequest, GenerateCvResponse, parse_request_id
from app.services.azure_openai import AzureOpenAIError
from app.services.cv_generation import CvGenerationService, InvalidGeneratedCvError
from app.services.profile_repository import ProfileRepository


router = APIRouter(prefix="/api", tags=["cv-generation"])
logger = logging.getLogger(__name__)


def get_generation_service() -> CvGenerationService:
    return CvGenerationService(profile_repository=ProfileRepository())


@router.post("/generate-cv", response_model=GenerateCvResponse)
async def generate_cv(
    payload: GenerateCvRequest,
    user_id: Annotated[str, Depends(require_user_id)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    service: Annotated[CvGenerationService, Depends(get_generation_service)] = None,
) -> GenerateCvResponse:
    if not payload.text.strip():
        raise _error(status.HTTP_400_BAD_REQUEST, "empty_text", "El texto profesional no puede estar vacío")

    if not idempotency_key:
        raise _error(status.HTTP_400_BAD_REQUEST, "missing_idempotency_key", "Idempotency-Key es obligatorio")

    try:
        request_id = parse_request_id(idempotency_key)
    except ValueError:
        raise _error(status.HTTP_400_BAD_REQUEST, "invalid_idempotency_key", "Idempotency-Key debe ser un UUID")

    try:
        result = await service.generate(user_id, str(request_id), payload.text)
    except InvalidGeneratedCvError:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_model_response", "La respuesta generada no es válida")
    except AzureOpenAIError:
        raise _error(status.HTTP_502_BAD_GATEWAY, "provider_unavailable", "El servicio de generación no está disponible")
    except Exception as exc:
        logger.error("cv_generation_failed", extra={"error_type": type(exc).__name__})
        raise _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "generation_failed", "No se pudo completar la generación")
    return GenerateCvResponse.model_validate(result.model_dump())


def _error(code: int, error_code: str, message: str) -> HTTPException:
    return HTTPException(status_code=code, detail={"code": error_code, "message": message})