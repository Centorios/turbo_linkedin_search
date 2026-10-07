import logging
from functools import lru_cache
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from starlette.concurrency import run_in_threadpool

from app.core.auth import require_user_id
from app.core.settings import get_settings
from app.models.cv import StructuredCv
from app.models.jobs import JobSearchProfile, JobSearchRequest, JobSearchResponse
from app.services.job_search import build_search_profile
from app.services.jooble import JobSourceError, JobSourceUnconfigured, JoobleJobsProvider
from app.services.resume_repository import ResumeRepository


router = APIRouter(prefix="/api/jobs", tags=["jobs"])
logger = logging.getLogger(__name__)


def get_resume_repository() -> ResumeRepository:
    return ResumeRepository()


@lru_cache
def get_job_provider() -> JoobleJobsProvider:
    return JoobleJobsProvider(get_settings().jooble_ar_api_key)


async def _load_owned_cv(repository: ResumeRepository, user_id: str, resume_id: UUID) -> StructuredCv:
    try:
        row = await run_in_threadpool(repository.get_by_id, user_id, str(resume_id))
        if row is None:
            raise HTTPException(status_code=404, detail={"code": "resume_not_found", "message": "El CV no está disponible"})
        return StructuredCv.model_validate(row["data"])
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("job_search_resume_read_failed", extra={"error_type": type(exc).__name__})
        raise HTTPException(status_code=500, detail={"code": "resume_read_failed", "message": "No se pudo cargar el CV. Inténtalo de nuevo."}) from exc


@router.get("/search-profile/{resume_id}", response_model=JobSearchProfile)
async def get_search_profile(
    resume_id: UUID,
    user_id: Annotated[str, Depends(require_user_id)],
    repository: Annotated[ResumeRepository, Depends(get_resume_repository)],
) -> JobSearchProfile:
    cv = await _load_owned_cv(repository, user_id, resume_id)
    return build_search_profile(resume_id, cv)


@router.post("/search", response_model=JobSearchResponse)
async def search_jobs(
    request: JobSearchRequest,
    user_id: Annotated[str, Depends(require_user_id)],
    repository: Annotated[ResumeRepository, Depends(get_resume_repository)],
    provider: Annotated[JoobleJobsProvider, Depends(get_job_provider)],
) -> JobSearchResponse:
    await _load_owned_cv(repository, user_id, request.resumeId)
    try:
        jobs = await provider.search(request.keywords, request.location)
    except JobSourceUnconfigured as exc:
        raise HTTPException(status_code=503, detail={"code": "jobs_not_configured", "message": "La búsqueda de empleos aún no está configurada."}) from exc
    except JobSourceError as exc:
        raise HTTPException(status_code=502, detail={"code": "jobs_source_failed", "message": "No se pudieron consultar las ofertas. Inténtalo de nuevo."}) from exc
    seen: set[str] = set()
    unique = []
    for job in jobs:
        if job.id not in seen:
            seen.add(job.id)
            unique.append(job)
    return JobSearchResponse(items=unique[:20])
