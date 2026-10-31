import logging
from typing import Annotated
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status

from app.core.auth import require_user_id
from app.models.cv_import import (
    CvImportResponse,
    EditRequest,
    EditResponse,
    ResumeEditRequest,
    ResumeVersion,
    ResumeVersionRequest,
    SaveVersionRequest,
)
from app.models.generate_cv import parse_request_id
from app.services.azure_openai import AzureOpenAIError
from app.services.cv_import import (
    CvImportService,
    CvSourceNotFoundError,
    InvalidCvImportResponseError,
    InvalidPdfError,
    decode_original_filename,
    NoChangesError,
)
from app.services.cv_photo import InvalidCvPhotoError
from app.services.profile_certificate_service import InvalidCertificateExtractionError


router = APIRouter(prefix="/api/cv-imports", tags=["cv-imports"])
# Editing any version of the history reuses the import editor's flow.
resume_edits_router = APIRouter(prefix="/api/resumes", tags=["resumes"])
logger = logging.getLogger(__name__)
MAX_PDF_BYTES = 10 * 1024 * 1024


def get_cv_import_service() -> CvImportService:
    return CvImportService()


@router.post("", response_model=CvImportResponse, status_code=status.HTTP_201_CREATED)
async def import_cv(
    request: Request,
    user_id: Annotated[str, Depends(require_user_id)],
    service: Annotated[CvImportService, Depends(get_cv_import_service)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    original_filename: Annotated[
        str | None,
        Header(alias="X-Original-Filename", max_length=3060),
    ] = None,
) -> CvImportResponse:
    request_id = _request_uuid(idempotency_key)
    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if content_type != "application/pdf":
        raise _error(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "unsupported_media_type", "El archivo debe ser un PDF")
    if original_filename is None:
        raise _error(status.HTTP_400_BAD_REQUEST, "missing_filename", "El nombre del archivo es obligatorio")
    try:
        filename = decode_original_filename(original_filename)
        pdf_bytes = await _read_bounded_body(request)
        result = await service.import_pdf(user_id, str(request_id), filename, pdf_bytes)
    except InvalidPdfError as exc:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_pdf", str(exc)) from exc
    except AzureOpenAIError:
        raise _error(status.HTTP_502_BAD_GATEWAY, "provider_unavailable", "El servicio de generación no está disponible")
    except InvalidCvImportResponseError:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_model_response", "La respuesta generada no es válida")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("cv_import_failed", extra={"error_type": type(exc).__name__})
        raise _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "cv_import_failed", "No se pudo importar el CV") from exc
    return result


@router.post("/{source_id}/edits", response_model=EditResponse)
async def propose_edit(
    source_id: UUID,
    payload: EditRequest,
    user_id: Annotated[str, Depends(require_user_id)],
    service: Annotated[CvImportService, Depends(get_cv_import_service)],
) -> EditResponse:
    try:
        return await service.propose_edit(user_id, str(source_id), payload)
    except CvSourceNotFoundError:
        raise _not_found()
    except InvalidCvImportResponseError:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_model_response", "La propuesta de edición no es válida")
    except AzureOpenAIError:
        raise _error(status.HTTP_502_BAD_GATEWAY, "provider_unavailable", "El servicio de edición no está disponible")
    except Exception as exc:
        logger.error("cv_edit_proposal_failed", extra={"error_type": type(exc).__name__})
        raise _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "cv_edit_failed", "No se pudo proponer el cambio") from exc


@router.post("/{source_id}/versions", response_model=ResumeVersion, status_code=status.HTTP_201_CREATED)
def save_version(
    source_id: UUID,
    payload: SaveVersionRequest,
    user_id: Annotated[str, Depends(require_user_id)],
    service: Annotated[CvImportService, Depends(get_cv_import_service)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> ResumeVersion:
    request_id = _request_uuid(idempotency_key)
    try:
        return service.save_version(user_id, str(source_id), str(request_id), payload)
    except CvSourceNotFoundError:
        raise _not_found()
    except InvalidCertificateExtractionError as exc:
        raise _error(422, "invalid_certificate_selection", str(exc)) from exc
    except InvalidCvPhotoError as exc:
        raise _error(422, "invalid_photo", "La foto no está disponible") from exc
    except NoChangesError as exc:
        raise _error(409, "no_changes", "La propuesta no contiene cambios") from exc
    except ValueError as exc:
        raise _error(status.HTTP_409_CONFLICT, "idempotency_conflict", "La clave ya se utilizó para otra versión") from exc
    except InvalidCvImportResponseError:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_cv", "El CV no es válido")
    except Exception as exc:
        logger.error("cv_version_save_failed", extra={"error_type": type(exc).__name__})
        raise _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "cv_version_save_failed", "No se pudo guardar la versión") from exc


@router.get("/{source_id}/file")
def download_source(
    source_id: UUID,
    user_id: Annotated[str, Depends(require_user_id)],
    service: Annotated[CvImportService, Depends(get_cv_import_service)],
) -> Response:
    try:
        file_bytes, filename = service.download_source(user_id, str(source_id))
    except CvSourceNotFoundError:
        raise _not_found()
    except Exception as exc:
        logger.error("cv_source_download_failed", extra={"error_type": type(exc).__name__})
        raise _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "cv_source_download_failed", "No se pudo descargar el PDF") from exc
    disposition_name = quote(filename, safe="")
    return Response(
        content=file_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{disposition_name}"},
    )


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_source(
    source_id: UUID,
    user_id: Annotated[str, Depends(require_user_id)],
    service: Annotated[CvImportService, Depends(get_cv_import_service)],
) -> Response:
    try:
        service.delete_source(user_id, str(source_id))
    except CvSourceNotFoundError:
        raise _not_found()
    except Exception as exc:
        logger.error("cv_source_delete_failed", extra={"error_type": type(exc).__name__})
        raise _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "cv_source_delete_failed", "No se pudo eliminar el CV importado") from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _read_bounded_body(request: Request) -> bytes:
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            if int(content_length) > MAX_PDF_BYTES:
                raise _error(status.HTTP_413_CONTENT_TOO_LARGE, "file_too_large", "El PDF supera el límite de 10 MiB")
        except ValueError as exc:
            raise _error(status.HTTP_400_BAD_REQUEST, "invalid_content_length", "El tamaño del archivo no es válido") from exc

    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_PDF_BYTES:
            raise _error(status.HTTP_413_CONTENT_TOO_LARGE, "file_too_large", "El PDF supera el límite de 10 MiB")
        body.extend(chunk)
    return bytes(body)


def _request_uuid(value: str | None) -> UUID:
    if value is None:
        raise _error(status.HTTP_400_BAD_REQUEST, "missing_idempotency_key", "Idempotency-Key es obligatorio")
    try:
        return parse_request_id(value)
    except ValueError as exc:
        raise _error(status.HTTP_400_BAD_REQUEST, "invalid_idempotency_key", "Idempotency-Key debe ser un UUID") from exc


@resume_edits_router.post("/{resume_id}/edits", response_model=EditResponse)
async def propose_resume_edit(
    resume_id: UUID,
    payload: ResumeEditRequest,
    user_id: Annotated[str, Depends(require_user_id)],
    service: Annotated[CvImportService, Depends(get_cv_import_service)],
) -> EditResponse:
    try:
        return await service.propose_resume_edit(user_id, str(resume_id), payload)
    except CvSourceNotFoundError:
        raise _resume_not_found()
    except InvalidCvImportResponseError:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_model_response", "La propuesta de edición no es válida")
    except AzureOpenAIError:
        raise _error(status.HTTP_502_BAD_GATEWAY, "provider_unavailable", "El servicio de edición no está disponible")
    except Exception as exc:
        logger.error("resume_edit_proposal_failed", extra={"error_type": type(exc).__name__})
        raise _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "cv_edit_failed", "No se pudo proponer el cambio") from exc


@resume_edits_router.post("/{resume_id}/versions", response_model=ResumeVersion, status_code=status.HTTP_201_CREATED)
def save_resume_version(
    resume_id: UUID,
    payload: ResumeVersionRequest,
    user_id: Annotated[str, Depends(require_user_id)],
    service: Annotated[CvImportService, Depends(get_cv_import_service)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> ResumeVersion:
    request_id = _request_uuid(idempotency_key)
    try:
        return service.save_resume_version(user_id, str(resume_id), str(request_id), payload.data,
            [str(value) for value in payload.selectedCertificateIds])
    except CvSourceNotFoundError:
        raise _resume_not_found()
    except InvalidCertificateExtractionError as exc:
        raise _error(422, "invalid_certificate_selection", str(exc)) from exc
    except InvalidCvPhotoError as exc:
        raise _error(422, "invalid_photo", "La foto no está disponible") from exc
    except NoChangesError as exc:
        raise _error(409, "no_changes", "La propuesta no contiene cambios") from exc
    except ValueError as exc:
        raise _error(status.HTTP_409_CONFLICT, "idempotency_conflict", "La clave ya se utilizó para otra versión") from exc
    except InvalidCvImportResponseError:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_cv", "El CV no es válido")
    except Exception as exc:
        logger.error("resume_version_save_failed", extra={"error_type": type(exc).__name__})
        raise _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "cv_version_save_failed", "No se pudo guardar la versión") from exc


def _resume_not_found() -> HTTPException:
    # Same answer for a missing version and another account's version.
    return _error(status.HTTP_404_NOT_FOUND, "resume_not_found", "No encontramos esa versión del CV.")


def _not_found() -> HTTPException:
    return _error(status.HTTP_404_NOT_FOUND, "cv_source_not_found", "El CV importado no está disponible")


def _error(code: int, error_code: str, message: str) -> HTTPException:
    return HTTPException(status_code=code, detail={"code": error_code, "message": message})
