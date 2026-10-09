import logging
from functools import lru_cache
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from app.core.auth import require_user_id
from app.core.settings import get_settings
from app.models.cv import StructuredCv
from app.models.jobs import JobSearchProfile, JobSearchRequest, JobSearchResponse
from app.models.match import MatchRequest, MatchResult
from app.services.job_search import build_search_profile
from app.services.jooble import JobSourceError, JobSourceUnconfigured, JoobleJobsProvider
from app.services.azure_openai import AzureOpenAIProvider
from app.services.job_search_repository import JobSearchRepository
from app.services.match_repository import MatchRepository
from app.services.match_service import (
    MatchInProgress,
    MatchNotFound,
    MatchProviderUnavailable,
    MatchService,
    MatchTimeout,
    MatchUnavailable,
)
from app.services.resume_repository import ResumeRepository


router = APIRouter(prefix="/api/jobs", tags=["jobs"])
logger = logging.getLogger(__name__)


def get_resume_repository() -> ResumeRepository:
    return ResumeRepository()


def get_job_search_repository() -> JobSearchRepository:
    return JobSearchRepository()


def get_match_repository() -> MatchRepository:
    return MatchRepository()


@lru_cache
def get_job_provider() -> JoobleJobsProvider:
    return JoobleJobsProvider(get_settings().jooble_ar_api_key)


@lru_cache
def get_match_provider() -> AzureOpenAIProvider:
    return AzureOpenAIProvider(get_settings())


def get_match_service(
    job_search_repository: Annotated[JobSearchRepository, Depends(get_job_search_repository)],
    match_repository: Annotated[MatchRepository, Depends(get_match_repository)],
    resume_repository: Annotated[ResumeRepository, Depends(get_resume_repository)],
    provider: Annotated[AzureOpenAIProvider, Depends(get_match_provider)],
) -> MatchService:
    return MatchService(
        job_search_repository,
        match_repository,
        resume_repository,
        provider,
        get_settings(),
    )


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
    search_repository: Annotated[JobSearchRepository, Depends(get_job_search_repository)],
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
    unique = unique[:20]
    search_id = None
    try:
        search_id = await run_in_threadpool(
            search_repository.create_search,
            user_id,
            str(request.resumeId),
            request.keywords,
            request.location,
            unique,
        )
    except Exception as exc:
        logger.warning("job_search_persistence_failed", extra={"error_type": type(exc).__name__})
    return JobSearchResponse(items=unique, searchId=search_id)


@router.post("/match", response_model=MatchResult)
async def match_jobs(
    request: MatchRequest,
    user_id: Annotated[str, Depends(require_user_id)],
    service: Annotated[MatchService, Depends(get_match_service)],
) -> MatchResult:
    try:
        return await service.run(user_id, request)
    except MatchNotFound as exc:
        raise HTTPException(
            status_code=404,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    except MatchInProgress as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "match_in_progress",
                "message": "Ya hay un análisis en curso para esta búsqueda y este CV.",
            },
        ) from exc
    except MatchTimeout as exc:
        raise HTTPException(
            status_code=504,
            detail={
                "code": "match_timeout",
                "message": "El análisis tardó más de lo esperado. Inténtalo de nuevo.",
            },
        ) from exc
    except MatchProviderUnavailable as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "match_unavailable",
                "message": "El servicio de análisis no respondió correctamente. Inténtalo de nuevo.",
            },
        ) from exc
    except MatchUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "match_unavailable",
                "message": "No se pudo completar el análisis. Inténtalo de nuevo.",
            },
        ) from exc


@router.get("/match/{search_id}", response_model=MatchResult)
async def get_match_result(
    search_id: UUID,
    resume_id: Annotated[UUID, Query(alias="resumeId")],
    user_id: Annotated[str, Depends(require_user_id)],
    service: Annotated[MatchService, Depends(get_match_service)],
) -> MatchResult:
    try:
        return await service.get_saved(user_id, str(search_id), str(resume_id))
    except MatchNotFound as exc:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "match_not_found",
                "message": "Las recomendaciones no están disponibles",
            },
        ) from exc
    except MatchUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "match_unavailable",
                "message": "No se pudieron recuperar las recomendaciones. Inténtalo de nuevo.",
            },
        ) from exc
