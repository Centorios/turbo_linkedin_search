import logging
from typing import Annotated
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status

from app.core.auth import require_user_id
from app.models.profile_certificate import CertificatePage, CertificateReviewRequest, ProfileCertificate
from app.services.azure_openai import AzureOpenAIError
from app.services.certificate_extraction import (
    ALLOWED_MIME_TYPES, MAX_CERTIFICATE_BYTES, InvalidCertificateError, safe_filename,
)
from app.services.profile_certificate_service import (
    CertificateConflictError, CertificateLimitError, CertificateNotFoundError,
    InvalidCertificateExtractionError, ProfileCertificateService,
)


router = APIRouter(prefix="/api/profile/certificates", tags=["profile-certificates"])
logger = logging.getLogger(__name__)


def get_certificate_service() -> ProfileCertificateService:
    return ProfileCertificateService()


def error(http_status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=http_status, detail={"code": code, "message": message})


@router.get("", response_model=CertificatePage)
def list_certificates(
    user_id: Annotated[str, Depends(require_user_id)],
    service: Annotated[ProfileCertificateService, Depends(get_certificate_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=50)] = 50,
) -> CertificatePage:
    try:
        return service.list(user_id, offset, limit)
    except Exception as exc:
        logger.error("certificate_list_failed", extra={"error_type": type(exc).__name__})
        raise error(500, "certificate_list_failed", "No se pudo cargar la lista de certificados. Verificá la conexión con Supabase y la migración 010_user_certificates.sql.") from exc


@router.post("", response_model=ProfileCertificate, status_code=status.HTTP_201_CREATED)
async def upload_certificate(
    request: Request,
    user_id: Annotated[str, Depends(require_user_id)],
    service: Annotated[ProfileCertificateService, Depends(get_certificate_service)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    original_filename: Annotated[str | None, Header(alias="X-Original-Filename")] = None,
) -> ProfileCertificate:
    if not idempotency_key:
        raise error(400, "missing_idempotency_key", "Idempotency-Key es obligatorio")
    try:
        request_id = str(UUID(idempotency_key))
    except ValueError as exc:
        raise error(400, "invalid_idempotency_key", "Idempotency-Key debe ser un UUID") from exc
    if original_filename is None:
        raise error(400, "missing_filename", "El nombre del archivo es obligatorio")
    try:
        filename = safe_filename(original_filename)
    except InvalidCertificateError as exc:
        raise error(422, "invalid_filename", str(exc)) from exc
    mime_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if mime_type not in ALLOWED_MIME_TYPES:
        raise error(415, "unsupported_media_type", "Seleccioná un PDF, JPEG o PNG")
    content = bytearray()
    async for chunk in request.stream():
        if len(content) + len(chunk) > MAX_CERTIFICATE_BYTES:
            raise error(413, "file_too_large", "El certificado supera el límite de 5 MiB")
        content.extend(chunk)
    try:
        return await service.upload(user_id, request_id, filename, mime_type, bytes(content))
    except InvalidCertificateError as exc:
        raise error(422, "invalid_certificate", str(exc)) from exc
    except InvalidCertificateExtractionError as exc:
        raise error(422, "invalid_extraction", str(exc)) from exc
    except CertificateConflictError as exc:
        raise error(409, "idempotency_conflict", "La clave ya se utilizó para otro certificado") from exc
    except CertificateLimitError as exc:
        raise error(409, "certificate_limit", "El perfil admite hasta 50 certificados") from exc
    except AzureOpenAIError as exc:
        raise error(502, "provider_unavailable", "No se pudo procesar el certificado") from exc
    except Exception as exc:
        logger.error("certificate_upload_failed", extra={"error_type": type(exc).__name__})
        raise error(500, "certificate_upload_failed", "No se pudo subir el certificado") from exc


@router.patch("/{certificate_id}", response_model=ProfileCertificate)
def review_certificate(
    certificate_id: UUID,
    payload: CertificateReviewRequest,
    user_id: Annotated[str, Depends(require_user_id)],
    service: Annotated[ProfileCertificateService, Depends(get_certificate_service)],
) -> ProfileCertificate:
    try:
        return service.review(user_id, str(certificate_id), payload)
    except CertificateNotFoundError as exc:
        raise error(404, "certificate_not_found", "No encontramos ese certificado") from exc
    except InvalidCertificateExtractionError as exc:
        raise error(422, "invalid_certificate", str(exc)) from exc
    except CertificateConflictError as exc:
        raise error(409, "duplicate_certificate", "Este certificado ya existe en tu perfil") from exc


@router.get("/{certificate_id}/file")
def download_certificate(
    certificate_id: UUID,
    user_id: Annotated[str, Depends(require_user_id)],
    service: Annotated[ProfileCertificateService, Depends(get_certificate_service)],
) -> Response:
    try:
        content, row = service.download(user_id, str(certificate_id))
    except CertificateNotFoundError as exc:
        raise error(404, "certificate_not_found", "No encontramos ese certificado") from exc
    return Response(content=content, media_type=row["mime_type"], headers={
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(row['original_filename'], safe='')}"
    })


@router.delete("/{certificate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_certificate(
    certificate_id: UUID,
    user_id: Annotated[str, Depends(require_user_id)],
    service: Annotated[ProfileCertificateService, Depends(get_certificate_service)],
) -> Response:
    try:
        service.delete(user_id, str(certificate_id))
    except CertificateNotFoundError as exc:
        raise error(404, "certificate_not_found", "No encontramos ese certificado") from exc
    except Exception as exc:
        logger.error("certificate_delete_failed", extra={"error_type": type(exc).__name__})
        raise error(500, "certificate_delete_failed", "No se pudo eliminar el certificado. Intentá de nuevo.") from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
