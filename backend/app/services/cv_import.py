import logging
import re
from io import BytesIO
from typing import Any
from urllib.parse import unquote
from uuid import uuid4

from pydantic import ValidationError
from pypdf import PdfReader
from pypdf.errors import PyPdfError

from app.models.cv import StructuredCv
from app.models.cv_import import (
    CvImportResponse,
    CvSource,
    EditNeedsInput,
    EditReady,
    EditRequest,
    ResumeVersion,
    SaveVersionRequest,
)
from app.services.azure_openai import AzureOpenAIError, AzureOpenAIProvider
from app.services.cv_import_repository import CvImportRepository


logger = logging.getLogger(__name__)
MAX_PDF_BYTES = 10 * 1024 * 1024
MAX_PDF_PAGES = 20
MAX_FILENAME_HEADER_LENGTH = 3060
_PERCENT_ESCAPE = re.compile(r"%(?![0-9A-Fa-f]{2})")
_SECTION_LABELS = {
    "personalInfo": "información personal",
    "summary": "resumen",
    "experience": "experiencia",
    "education": "educación",
    "skills": "habilidades",
    "languages": "idiomas",
    "certifications": "certificaciones",
}


class InvalidPdfError(Exception):
    pass


class InvalidCvImportResponseError(Exception):
    pass


class CvSourceNotFoundError(Exception):
    pass


def extract_pdf_content(document: bytes) -> tuple[str, int]:
    if not document:
        raise InvalidPdfError("El PDF está vacío")
    if len(document) > MAX_PDF_BYTES:
        raise InvalidPdfError("El archivo supera el límite de 10 MiB")
    if not document.startswith(b"%PDF-"):
        raise InvalidPdfError("El archivo no tiene una firma PDF válida")

    try:
        reader = PdfReader(BytesIO(document), strict=False)
        if reader.is_encrypted:
            raise InvalidPdfError("No se admiten PDFs protegidos por contraseña")
        page_count = len(reader.pages)
        if page_count < 1:
            raise InvalidPdfError("El PDF no contiene páginas")
        if page_count > MAX_PDF_PAGES:
            raise InvalidPdfError("El PDF supera el límite de 20 páginas")
        text = " ".join(
            extracted.strip()
            for page in reader.pages
            if (extracted := page.extract_text() or "").strip()
        )
    except InvalidPdfError:
        raise
    except (PyPdfError, OSError, ValueError, EOFError, RecursionError) as exc:
        raise InvalidPdfError("No se pudo leer el PDF") from exc
    if not text.strip():
        raise InvalidPdfError("El PDF no contiene texto extraíble")
    return text, page_count


def extract_pdf_text(document: bytes) -> str:
    return extract_pdf_content(document)[0]


def decode_original_filename(value: str) -> str:
    if len(value) > MAX_FILENAME_HEADER_LENGTH or _PERCENT_ESCAPE.search(value):
        raise InvalidPdfError("El nombre del archivo no es válido")
    try:
        decoded = unquote(value, errors="strict")
    except UnicodeDecodeError as exc:
        raise InvalidPdfError("El nombre del archivo no es UTF-8 válido") from exc
    filename = decoded.replace("\\", "/").rsplit("/", 1)[-1].strip()
    filename = "".join(char for char in filename if ord(char) >= 32 and ord(char) != 127)
    if not filename or filename in {".", ".."} or len(filename) > 255:
        raise InvalidPdfError("El nombre del archivo no es válido")
    return filename


class CvImportService:
    def __init__(
        self,
        provider: AzureOpenAIProvider | None = None,
        repository: CvImportRepository | None = None,
    ) -> None:
        self.provider = provider or AzureOpenAIProvider()
        self.repository = repository or CvImportRepository()

    async def import_pdf(
        self,
        user_id: str,
        request_id: str,
        filename: str,
        file_bytes: bytes,
    ) -> CvImportResponse:
        existing = self.repository.get_import_by_request(user_id, request_id)
        if existing:
            return self._import_response(existing)

        text, page_count = extract_pdf_content(file_bytes)
        try:
            generated = await self.provider.generate_cv(text)
            document = StructuredCv.model_validate(generated)
        except ValidationError as exc:
            logger.warning("cv_import_invalid_generated_cv", extra={"issues": len(exc.errors())})
            raise InvalidCvImportResponseError("Generated CV did not match StructuredCv") from exc
        except AzureOpenAIError:
            raise

        record = self.repository.create_import(
            user_id=user_id,
            request_id=request_id,
            source_id=str(uuid4()),
            filename=filename,
            file_bytes=file_bytes,
            page_count=page_count,
            data=document.model_dump(),
        )
        return self._import_response(record)

    async def propose_edit(self, user_id: str, source_id: str, request: EditRequest) -> EditNeedsInput | EditReady:
        source_id = str(source_id)
        source = self.repository.get_source(user_id, source_id)
        base = self.repository.get_resume(user_id, str(request.baseResumeId))
        if source is None or base is None or base.get("source_id") != source_id:
            raise CvSourceNotFoundError("CV source not found")

        base_cv = self._validate_cv(base.get("data"))
        edit_base = request.currentCv or base_cv
        try:
            result = await self.provider.edit_cv(
                edit_base.model_dump(),
                request.instruction,
                request.answers,
            )
            if result.get("status") == "needs_input":
                return EditNeedsInput.model_validate(result)
            if result.get("status") != "ready":
                raise InvalidCvImportResponseError("CV edit response has an invalid status")
            proposed = self._validate_cv(result.get("proposedCv"))
        except (ValidationError, AttributeError, TypeError) as exc:
            raise InvalidCvImportResponseError("CV edit response did not match its contract") from exc
        except AzureOpenAIError:
            raise

        base_data = edit_base.model_dump()
        proposed_data = proposed.model_dump()
        changed = [key for key in base_data if base_data[key] != proposed_data[key]]
        summary = (
            "Se proponen cambios en " + ", ".join(_SECTION_LABELS[key] for key in changed) + "."
            if changed
            else "La propuesta no contiene cambios respecto de la versión actual."
        )
        return EditReady(
            status="ready",
            proposedCv=proposed,
            changedSections=changed,
            changeSummary=summary,
        )

    def save_version(
        self,
        user_id: str,
        source_id: str,
        request_id: str,
        request: SaveVersionRequest,
    ) -> ResumeVersion:
        source_id = str(source_id)
        source = self.repository.get_source(user_id, source_id)
        base = self.repository.get_resume(user_id, str(request.baseResumeId))
        if source is None or base is None or base.get("source_id") != source_id:
            raise CvSourceNotFoundError("CV source not found")
        saved = self.repository.create_version(
            user_id=user_id,
            source_id=source_id,
            request_id=request_id,
            parent_resume_id=str(request.baseResumeId),
            data=request.data.model_dump(),
        )
        return self._resume_version(saved, source_id)

    def download_source(self, user_id: str, source_id: str) -> tuple[bytes, str]:
        result = self.repository.download_source(user_id, str(source_id))
        if result is None:
            raise CvSourceNotFoundError("CV source not found")
        return result

    def delete_source(self, user_id: str, source_id: str) -> bool:
        if not self.repository.delete_source(user_id, str(source_id)):
            raise CvSourceNotFoundError("CV source not found")
        return True

    @classmethod
    def _import_response(cls, record: dict[str, Any]) -> CvImportResponse:
        source = record["source"]
        resume = record["resume"]
        return CvImportResponse(
            source=CvSource(
                id=source["id"],
                originalFilename=source.get("original_filename", source.get("originalFilename")),
                fileSizeBytes=source.get("file_size_bytes", source.get("fileSizeBytes")),
                pageCount=source.get("page_count", source.get("pageCount")),
                createdAt=source.get("created_at", source.get("createdAt")),
            ),
            resume=cls._resume_version(resume, source["id"]),
        )

    @staticmethod
    def _resume_version(row: dict[str, Any], source_id: str) -> ResumeVersion:
        return ResumeVersion(
            id=row["id"],
            sourceId=source_id,
            parentResumeId=row.get("parent_resume_id", row.get("parentResumeId")),
            createdAt=row.get("created_at", row.get("createdAt")),
            data=StructuredCv.model_validate(row["data"]),
        )

    @staticmethod
    def _validate_cv(data: Any) -> StructuredCv:
        try:
            return StructuredCv.model_validate(data)
        except (ValidationError, TypeError) as exc:
            raise InvalidCvImportResponseError("CV data did not match StructuredCv") from exc
