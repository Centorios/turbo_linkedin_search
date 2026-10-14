import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from app.core.settings import Settings, get_settings
from app.models.cv import StructuredCv
from app.models.match import LlmMatchOutput, MatchRecommendation, MatchRequest, MatchResult
from app.services.azure_openai import AzureOpenAIError, AzureOpenAIProvider
from app.services.job_search_repository import JobSearchRepository, offer_content_hash
from app.services.match_repository import MatchRepository, resume_content_hash
from app.services.resume_repository import ResumeRepository


logger = logging.getLogger(__name__)


class MatchNotFound(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class MatchInProgress(Exception):
    pass


class MatchUnavailable(Exception):
    pass


class MatchProviderUnavailable(Exception):
    pass


class MatchTimeout(Exception):
    pass


class MatchService:
    def __init__(
        self,
        job_search_repository: JobSearchRepository,
        match_repository: MatchRepository,
        resume_repository: ResumeRepository,
        provider: AzureOpenAIProvider,
        settings: Settings | None = None,
    ) -> None:
        self.job_search_repository = job_search_repository
        self.match_repository = match_repository
        self.resume_repository = resume_repository
        self.provider = provider
        self.settings = settings or get_settings()

    async def get_saved(
        self, user_id: str, search_id: str, resume_id: str
    ) -> MatchResult:
        try:
            search = await run_in_threadpool(
                self.job_search_repository.get_search, user_id, search_id
            )
            if search is None or str(search.get("resume_id")) != resume_id:
                raise MatchNotFound(
                    "match_not_found", "Las recomendaciones no están disponibles"
                )

            resume_row = await run_in_threadpool(
                self.resume_repository.get_by_id, user_id, resume_id
            )
            if resume_row is None:
                raise MatchNotFound(
                    "match_not_found", "Las recomendaciones no están disponibles"
                )
            resume = StructuredCv.model_validate(resume_row["data"])
            resume_hash = resume_content_hash(resume.model_dump(mode="json"))

            saved_result = await run_in_threadpool(
                self.match_repository.get_saved_result,
                user_id,
                search_id,
                resume_id,
            )
            if saved_result is None:
                raise MatchNotFound(
                    "match_not_found", "Las recomendaciones no están disponibles"
                )
            resume_changed = saved_result.get("resume_content_hash") != resume_hash
            partial, can_recalculate = await self._run_state(user_id, search_id)
            return self._saved_result(saved_result, resume_changed, partial, can_recalculate)
        except MatchNotFound:
            raise
        except (ValidationError, ValueError, TypeError, KeyError) as exc:
            logger.warning(
                "match_saved_result_validation_failed",
                extra={"error_type": type(exc).__name__},
            )
            raise MatchUnavailable from exc
        except Exception as exc:
            logger.error(
                "match_saved_result_read_failed",
                extra={"error_type": type(exc).__name__},
            )
            raise MatchUnavailable from exc

    async def run(self, user_id: str, request: MatchRequest) -> MatchResult:
        try:
            async with asyncio.timeout(self.settings.match_deadline_seconds):
                return await self._run(user_id, request)
        except TimeoutError as exc:
            raise MatchTimeout from exc
        except (MatchNotFound, MatchInProgress, MatchUnavailable):
            raise
        except AzureOpenAIError as exc:
            logger.warning("match_azure_request_failed", extra={"error_type": type(exc).__name__})
            raise MatchProviderUnavailable from exc
        except (ValidationError, ValueError, TypeError, KeyError) as exc:
            logger.warning("match_validation_or_data_error", extra={"error_type": type(exc).__name__})
            raise MatchUnavailable from exc
        except Exception as exc:
            logger.error("match_execution_failed", extra={"error_type": type(exc).__name__})
            raise MatchUnavailable from exc

    async def _run(self, user_id: str, request: MatchRequest) -> MatchResult:
        search_id = str(request.searchId)
        resume_id = str(request.resumeId)
        search = await run_in_threadpool(
            self.job_search_repository.get_search, user_id, search_id
        )
        if search is None or str(search.get("resume_id")) != resume_id:
            raise MatchNotFound("search_not_found", "La búsqueda no está disponible")

        resume_row = await run_in_threadpool(
            self.resume_repository.get_by_id, user_id, resume_id
        )
        if resume_row is None:
            raise MatchNotFound("resume_not_found", "El CV no está disponible")
        resume_data = resume_row["data"]
        resume = StructuredCv.model_validate(resume_data)
        resume_json = resume.model_dump(mode="json")
        resume_hash = resume_content_hash(resume_json)

        saved_result = await run_in_threadpool(
            self.match_repository.get_saved_result, user_id, search_id, resume_id
        )
        resume_changed = bool(
            saved_result and saved_result.get("resume_content_hash") != resume_hash
        )
        partial, can_recalculate = await self._run_state(user_id, search_id)
        if saved_result and not request.recalculate:
            return self._saved_result(saved_result, resume_changed, partial, can_recalculate)

        locked = await run_in_threadpool(self.match_repository.try_lock, search_id, resume_id)
        if not locked:
            raise MatchInProgress
        try:
            offers = await run_in_threadpool(
                self.job_search_repository.list_offers, user_id, search_id
            )
            candidates = (
                await self._get_candidates(
                    user_id, search_id, resume_id, resume_json, resume_hash, offers
                )
                if offers
                else []
            )
            if candidates:
                raw_output = await self.provider.analyze_match(resume_json, candidates)
                output = LlmMatchOutput.model_validate(raw_output)
                candidate_ids = {str(candidate["id"]) for candidate in candidates}
                if any(item.offerId not in candidate_ids for item in output.recommendations):
                    raise MatchUnavailable("Model recommended an offer outside the candidate set")
                recommendations = [
                    {
                        "offer_id": item.offerId,
                        "affinity": item.affinity,
                        "summary": item.summary,
                        "matches": item.matches,
                        "unmet_requirements": item.unmetRequirements,
                        "missing_info": item.missingInfo,
                    }
                    for item in output.recommendations
                ]
                recommendations.sort(key=lambda item: item["affinity"] != "Alta")
            else:
                recommendations = []

            await run_in_threadpool(
                self.match_repository.save_result,
                user_id,
                search_id,
                resume_id,
                resume_hash,
                recommendations,
            )
            offer_by_id = {str(offer["id"]): offer for offer in offers}
            response_recommendations = [
                MatchRecommendation(
                    rank=index,
                    offerId=item["offer_id"],
                    title=offer_by_id[item["offer_id"]]["title"],
                    company=offer_by_id[item["offer_id"]]["company"],
                    location=offer_by_id[item["offer_id"]]["location"],
                    url=offer_by_id[item["offer_id"]]["url"],
                    affinity=item["affinity"],
                    summary=item["summary"],
                    matches=item["matches"],
                    unmetRequirements=item["unmet_requirements"],
                    missingInfo=item["missing_info"],
                    **self._offer_extras(offer_by_id[item["offer_id"]]),
                )
                for index, item in enumerate(recommendations, start=1)
            ]
            return MatchResult(
                resumeChanged=resume_changed,
                completedAt=datetime.now(timezone.utc),
                recommendations=response_recommendations,
                partial=partial,
                canRecalculate=can_recalculate,
            )
        finally:
            await run_in_threadpool(self.match_repository.release_lock, search_id, resume_id)

    async def _get_candidates(
        self,
        user_id: str,
        search_id: str,
        resume_id: str,
        resume: dict[str, Any],
        resume_hash: str,
        offers: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        model = self.settings.azure_openai_embedding_deployment
        existing_resume_embedding = await run_in_threadpool(
            self.match_repository.get_resume_embedding, user_id, resume_id
        )
        resume_vector = None
        if (
            existing_resume_embedding
            and existing_resume_embedding.get("content_hash") == resume_hash
            and existing_resume_embedding.get("model") == model
        ):
            resume_vector = self._parse_vector(existing_resume_embedding["embedding"])

        pending_offer_vectors: list[dict[str, Any]] = []
        for offer in offers:
            expected_hash = offer_content_hash(offer)
            if offer.get("content_hash") != expected_hash:
                raise MatchUnavailable("Stored offer content hash does not match its content")
            if offer.get("embedding") is None:
                pending_offer_vectors.append(offer)

        pending_texts: list[str] = []
        if resume_vector is None:
            pending_texts.append(
                json.dumps(resume, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
            )
        pending_texts.extend(self._offer_text(offer) for offer in pending_offer_vectors)

        if pending_texts:
            vectors = await self.provider.embed_texts(pending_texts)
            if len(vectors) != len(pending_texts):
                raise MatchUnavailable("Embedding batch returned an unexpected item count")
            if any(
                len(vector) != self.settings.azure_openai_embedding_dimensions
                for vector in vectors
            ):
                raise MatchUnavailable("Embedding batch returned an unexpected vector size")
            vector_index = 0
            if resume_vector is None:
                resume_vector = vectors[vector_index]
                vector_index += 1
                await run_in_threadpool(
                    self.match_repository.save_resume_embedding,
                    user_id,
                    resume_id,
                    resume_hash,
                    model,
                    resume_vector,
                )
            if pending_offer_vectors:
                offer_vectors = {
                    str(offer["id"]): vectors[vector_index + index]
                    for index, offer in enumerate(pending_offer_vectors)
                }
                await run_in_threadpool(
                    self.job_search_repository.save_offer_embeddings, offer_vectors
                )

        for offer in offers:
            if offer.get("embedding") is not None:
                self._parse_vector(offer["embedding"])

        matches = await run_in_threadpool(
            self.match_repository.match_candidates,
            search_id,
            resume_id,
            self.settings.match_candidates_k,
        )
        offer_by_id = {str(offer["id"]): offer for offer in offers}
        candidates = []
        for match in matches:
            offer_id = str(match["offer_id"])
            offer = offer_by_id.get(offer_id)
            if offer is None:
                raise MatchUnavailable("Candidate RPC returned an offer outside the search")
            candidates.append(
                {
                    "id": offer_id,
                    "title": offer["title"],
                    "company": offer["company"],
                    "location": offer["location"],
                    "snippet": offer["snippet"],
                    "description": offer.get("description"),
                    "source": offer.get("source"),
                    "url": offer["url"],
                    "similarity": match.get("similarity"),
                }
            )
        return candidates

    def _saved_result(
        self,
        saved_result: dict[str, Any],
        resume_changed: bool,
        partial: bool = False,
        can_recalculate: bool = False,
    ) -> MatchResult:
        recommendations = []
        for item in saved_result.get("recommendations", []):
            offer = item.get("job_search_offers") or {}
            if isinstance(offer, list):
                offer = offer[0] if offer else {}
            recommendations.append(
                MatchRecommendation(
                    rank=item["rank"],
                    offerId=str(item["offer_id"]),
                    title=offer["title"],
                    company=offer["company"],
                    location=offer["location"],
                    url=offer["url"],
                    affinity=item["affinity"],
                    summary=item["summary"],
                    matches=item["matches"],
                    unmetRequirements=item["unmet_requirements"],
                    missingInfo=item["missing_info"],
                    **self._offer_extras(offer),
                )
            )
        return MatchResult(
            resumeChanged=resume_changed,
            completedAt=saved_result["created_at"],
            recommendations=recommendations,
            partial=partial,
            canRecalculate=can_recalculate,
        )

    @staticmethod
    def _offer_extras(offer: dict[str, Any]) -> dict[str, Any]:
        return {
            "source": offer.get("source") or "Jooble",
            "alternateUrls": offer.get("alternate_urls") or [],
            "descriptionIsPartial": bool(offer.get("description_is_partial")),
        }

    async def _run_state(self, user_id: str, search_id: str) -> tuple[bool, bool]:
        runs = await run_in_threadpool(
            self.job_search_repository.list_source_runs, user_id, search_id
        )
        partial = any(run["status"] != "succeeded" for run in runs)
        can_recalculate = any(
            run["source"] == "linkedin" and run["status"] == "succeeded" for run in runs
        )
        return partial, can_recalculate

    @staticmethod
    def _offer_text(offer: dict[str, Any]) -> str:
        return "\n".join(
            [
                offer["title"],
                offer["company"],
                offer["location"],
                offer.get("description") or offer["snippet"],
            ]
        )

    def _parse_vector(self, value: Any) -> list[float]:
        if isinstance(value, str):
            value = json.loads(value)
        if not isinstance(value, list):
            raise ValueError("Stored embedding is not a vector")
        vector = [float(item) for item in value]
        if len(vector) != self.settings.azure_openai_embedding_dimensions:
            raise ValueError("Stored embedding has an unexpected dimension")
        return vector
