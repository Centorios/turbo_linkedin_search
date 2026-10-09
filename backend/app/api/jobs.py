import hmac
import logging
from functools import lru_cache
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from app.core.auth import require_user_id
from app.core.settings import get_settings
from app.models.cv import StructuredCv
from app.models.jobs import (
    JobListing,
    JobSearchProfile,
    JobSearchRequest,
    JobSearchResponse,
    JobSearchStatusResponse,
    JobSource,
    SourceState,
)
from app.models.match import MatchRequest, MatchResult
from app.services.apify_linkedin import ApifyLinkedInProvider
from app.services.job_search import build_search_profile
from app.services.job_search_orchestrator import JobSearchOrchestrator, aggregate_status
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
def get_apify_provider() -> ApifyLinkedInProvider:
    settings = get_settings()
    return ApifyLinkedInProvider(
        settings.apify_token,
        settings.apify_linkedin_actor_id,
        settings.apify_max_charge_usd,
        settings.apify_max_items,
    )


def get_orchestrator(
    search_repository: Annotated[JobSearchRepository, Depends(get_job_search_repository)],
    apify: Annotated[ApifyLinkedInProvider, Depends(get_apify_provider)],
) -> JobSearchOrchestrator:
    return JobSearchOrchestrator(search_repository, apify, get_settings().apify_run_timeout_seconds)


def _row_to_listing(row: dict[str, Any]) -> JobListing:
    return JobListing(
        id=row.get("external_id") or str(row.get("id")),
        title=row["title"],
        company=row.get("company") or "",
        location=row.get("location") or "",
        snippet=row.get("snippet") or "",
        description=row.get("description"),
        descriptionIsPartial=bool(row.get("description_is_partial")),
        url=row["url"],
        source=row.get("source") or "",
        sources=list(row.get("sources") or []),
        alternateUrls=list(row.get("alternate_urls") or []),
        updatedAt=row.get("source_updated_at"),
    )


def _source_states(runs: list[dict[str, Any]]) -> list[SourceState]:
    return [
        SourceState(
            source=run["source"],
            status=run["status"],
            offersCount=int(run.get("offers_count") or 0),
            error=run.get("error_code"),
        )
        for run in runs
    ]


async def _search_multi_source(
    request: JobSearchRequest,
    user_id: str,
    provider: JoobleJobsProvider,
    search_repository: JobSearchRepository,
    orchestrator: JobSearchOrchestrator,
) -> JobSearchResponse:
    wants_jooble = JobSource.jooble in request.sources
    jobs: list[JobListing] = []
    jooble_failed = False
    if wants_jooble:
        try:
            jobs = await provider.search(request.keywords, request.location)
        except (JobSourceUnconfigured, JobSourceError):
            jooble_failed = True
    linkedin_ready = orchestrator.provider.configured
    if (not wants_jooble or jooble_failed) and not linkedin_ready:
        code, status = ("jobs_not_configured", 503) if not wants_jooble else ("jobs_source_failed", 502)
        raise HTTPException(status_code=status, detail={"code": code, "message": "No se pudieron consultar las fuentes de ofertas."})
    search_id = None
    try:
        search_id = await run_in_threadpool(
            lambda: search_repository.create_search(
                user_id, str(request.resumeId), request.keywords, request.location,
                jobs[:20], sources=[s.value for s in request.sources], status="in_progress",
            )
        )
        if wants_jooble:
            await run_in_threadpool(
                search_repository.create_source_run, user_id, search_id, "jooble",
                "failed" if jooble_failed else "succeeded", offers_count=len(jobs[:20]),
                error_code="source_failed" if jooble_failed else None,
            )
    except Exception as exc:
        logger.warning("job_search_persistence_failed", extra={"error_type": type(exc).__name__})
        search_id = None
    linkedin_status = "failed"
    if search_id and linkedin_ready:
        linkedin_status = await orchestrator.start_linkedin(user_id, search_id, request.keywords, request.location)
    elif search_id:
        await run_in_threadpool(
            search_repository.create_source_run, user_id, search_id, "linkedin", "failed", error_code="unconfigured"
        )
    runs = await run_in_threadpool(search_repository.list_source_runs, user_id, search_id) if search_id else []
    states = _source_states(runs) or [SourceState(source=JobSource.linkedin, status=linkedin_status)]
    status = aggregate_status(runs) if runs else "incomplete"
    if search_id:
        await run_in_threadpool(search_repository.update_search_status, user_id, search_id, status)
    return JobSearchResponse(items=jobs[:20], searchId=search_id, status=status, sources=states)


async def _load_owned_search(search_repository: JobSearchRepository, user_id: str, search_id: UUID) -> dict[str, Any]:
    row = await run_in_threadpool(search_repository.get_search, user_id, str(search_id))
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "search_not_found", "message": "La búsqueda no está disponible"})
    return row


@router.get("/search/{search_id}/status", response_model=JobSearchStatusResponse)
async def get_search_status(
    search_id: UUID,
    user_id: Annotated[str, Depends(require_user_id)],
    search_repository: Annotated[JobSearchRepository, Depends(get_job_search_repository)],
    orchestrator: Annotated[JobSearchOrchestrator, Depends(get_orchestrator)],
) -> JobSearchStatusResponse:
    await _load_owned_search(search_repository, user_id, search_id)
    runs = await orchestrator.refresh(user_id, str(search_id))
    offers = await run_in_threadpool(search_repository.list_offers, user_id, str(search_id))
    linkedin_done = any(r["source"] == "linkedin" and r["status"] == "succeeded" for r in runs)
    return JobSearchStatusResponse(
        searchId=str(search_id),
        status=aggregate_status(runs) if runs else "complete",
        sources=_source_states(runs),
        items=[_row_to_listing(row) for row in offers],
        matchAvailable=bool(offers),
        canRecalculate=linkedin_done and bool(offers),
    )


@router.post("/search/{search_id}/sources/linkedin/retry", status_code=202)
async def retry_linkedin(
    search_id: UUID,
    user_id: Annotated[str, Depends(require_user_id)],
    search_repository: Annotated[JobSearchRepository, Depends(get_job_search_repository)],
    orchestrator: Annotated[JobSearchOrchestrator, Depends(get_orchestrator)],
) -> dict[str, str]:
    search = await _load_owned_search(search_repository, user_id, search_id)
    if not await orchestrator.can_retry(user_id, str(search_id)):
        raise HTTPException(status_code=409, detail={"code": "retry_not_applicable", "message": "No se puede reintentar esta fuente."})
    await orchestrator.start_linkedin(user_id, str(search_id), search["keywords"], search["location"])
    await orchestrator.refresh(user_id, str(search_id))
    return {"source": "linkedin"}


@router.post("/apify/webhook", status_code=202)
async def apify_webhook(
    payload: dict[str, Any],
    orchestrator: Annotated[JobSearchOrchestrator, Depends(get_orchestrator)],
    x_webhook_secret: Annotated[str | None, Header()] = None,
) -> dict[str, bool]:
    secret = get_settings().apify_webhook_secret
    if not secret:
        return {"processed": False}
    if not x_webhook_secret or not hmac.compare_digest(x_webhook_secret, secret):
        raise HTTPException(status_code=401, detail={"code": "unauthorized", "message": "No autorizado"})
    resource = payload.get("resource")
    run_id = resource.get("id") if isinstance(resource, dict) else None
    if not isinstance(run_id, str):
        return {"processed": False}
    return {"processed": await orchestrator.finalize_by_apify_run(run_id)}


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
    orchestrator: Annotated[JobSearchOrchestrator, Depends(get_orchestrator)],
) -> JobSearchResponse:
    await _load_owned_cv(repository, user_id, request.resumeId)
    if JobSource.linkedin in request.sources:
        return await _search_multi_source(request, user_id, provider, search_repository, orchestrator)
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
