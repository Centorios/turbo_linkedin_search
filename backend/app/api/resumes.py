import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import require_user_id
from app.models.cv import StructuredCv
from app.models.resume_history import ResumeDetail, ResumeHistoryPage, ResumeSummary
from app.services.resume_repository import ResumeRepository


router = APIRouter(prefix="/api/resumes", tags=["resume-history"])
logger = logging.getLogger(__name__)


def get_resume_repository() -> ResumeRepository:
    return ResumeRepository()


@router.get("", response_model=ResumeHistoryPage)
async def list_resumes(
    user_id: Annotated[str, Depends(require_user_id)],
    repository: Annotated[ResumeRepository, Depends(get_resume_repository)],
    offset: Annotated[int, Query(ge=0, le=100000)] = 0,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> ResumeHistoryPage:
    try:
        rows = repository.list_by_user(user_id, offset, limit)
        items = []
        for row in rows[:limit]:
            document = StructuredCv.model_validate(row["data"])
            items.append(ResumeSummary(id=row["id"], createdAt=row["created_at"], fullName=document.personalInfo.fullName, summary=document.summary))
        return ResumeHistoryPage(items=items, offset=offset, limit=limit, hasMore=len(rows) > limit)
    except Exception as exc:
        raise _read_error(exc) from exc


@router.get("/{resume_id}", response_model=ResumeDetail)
async def get_resume(
    resume_id: UUID,
    user_id: Annotated[str, Depends(require_user_id)],
    repository: Annotated[ResumeRepository, Depends(get_resume_repository)],
) -> ResumeDetail:
    try:
        row = repository.get_by_id(user_id, str(resume_id))
        document = ResumeDetail(id=row["id"], createdAt=row["created_at"], data=StructuredCv.model_validate(row["data"])) if row else None
    except Exception as exc:
        raise _read_error(exc) from exc
    if document is None:
        raise HTTPException(status_code=404, detail={"code": "resume_not_found", "message": "El CV no está disponible"})
    return document


def _read_error(exc: Exception) -> HTTPException:
    logger.error("resume_history_read_failed", extra={"error_type": type(exc).__name__})
    return HTTPException(status_code=500, detail={"code": "resume_read_failed", "message": "No se pudo cargar el historial de CVs. Inténtalo de nuevo."})
