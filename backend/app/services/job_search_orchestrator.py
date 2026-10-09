import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from app.models.jobs import JobListing
from app.services.apify_linkedin import ApifyLinkedInProvider, LinkedInSourceError, LinkedInSourceUnconfigured
from app.services.job_search_repository import JobSearchRepository


logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 3
ACTIVE = ("pending", "running")
TERMINAL_FAILURE = ("failed", "timed_out")


def _parse_ts(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    return None


def aggregate_status(runs: list[dict[str, Any]]) -> str:
    statuses = [run["status"] for run in runs]
    if any(status in ACTIVE for status in statuses):
        return "in_progress"
    if any(status in TERMINAL_FAILURE for status in statuses):
        return "incomplete"
    return "complete"


class JobSearchOrchestrator:
    def __init__(self, repository: JobSearchRepository, provider: ApifyLinkedInProvider, timeout_seconds: int = 180) -> None:
        self.repository = repository
        self.provider = provider
        self.timeout_seconds = timeout_seconds

    async def _call(self, fn, *args, **kwargs):
        return await asyncio.to_thread(fn, *args, **kwargs)

    async def start_linkedin(self, user_id: str, search_id: str, keywords: str, location: str) -> str:
        """Launches the Apify run and records it. Returns the resulting run status."""
        run = await self._call(self.repository.get_source_run, user_id, search_id, "linkedin")
        attempts = int((run or {}).get("attempts") or 0) + 1
        now = datetime.now(timezone.utc).isoformat()
        try:
            handle = await self.provider.start(keywords, location)
        except LinkedInSourceUnconfigured:
            await self._call(self.repository.create_source_run, user_id, search_id, "linkedin", "failed",
                             attempts=attempts, error_code="unconfigured", finished_at=now)
            return "failed"
        except LinkedInSourceError:
            await self._call(self.repository.create_source_run, user_id, search_id, "linkedin", "failed",
                             attempts=attempts, error_code="start_failed", finished_at=now)
            return "failed"
        await self._call(
            self.repository.create_source_run, user_id, search_id, "linkedin", "running",
            attempts=attempts, apify_run_id=handle.run_id, apify_dataset_id=handle.dataset_id,
            started_at=now, finished_at=None, error_code=None,
        )
        return "running"

    async def can_retry(self, user_id: str, search_id: str) -> bool:
        run = await self._call(self.repository.get_source_run, user_id, search_id, "linkedin")
        return bool(run and run["status"] in TERMINAL_FAILURE and int(run.get("attempts") or 0) < MAX_ATTEMPTS)

    async def refresh(self, user_id: str, search_id: str) -> list[dict[str, Any]]:
        """Polls active LinkedIn runs, persists results idempotently, updates the search status."""
        run = await self._call(self.repository.get_source_run, user_id, search_id, "linkedin")
        if run and run["status"] in ACTIVE:
            await self._poll(user_id, search_id, run)
        runs = await self._call(self.repository.list_source_runs, user_id, search_id)
        await self._call(self.repository.update_search_status, user_id, search_id, aggregate_status(runs))
        return runs

    async def _poll(self, user_id: str, search_id: str, run: dict[str, Any]) -> None:
        run_id = run.get("apify_run_id")
        if not run_id:
            return
        now = datetime.now(timezone.utc)
        try:
            status = await self.provider.get_run(run_id)
        except (LinkedInSourceError, LinkedInSourceUnconfigured):
            status = None
        started = _parse_ts(run.get("started_at"))
        if status is None or status.status in ("READY", "RUNNING", "ABORTING"):
            if started and (now - started).total_seconds() > self.timeout_seconds:
                if await self._call(self.repository.transition_source_run, user_id, search_id, "linkedin",
                                    run["status"], "timed_out", error_code="timeout", finished_at=now.isoformat()):
                    await self.provider.abort(run_id)
            return
        if status.status == "SUCCEEDED":
            await self._finalize(user_id, search_id, run, status.dataset_id or run.get("apify_dataset_id"), status.cost_usd)
        else:
            await self._call(self.repository.transition_source_run, user_id, search_id, "linkedin",
                             run["status"], "failed", error_code=f"apify_{status.status.lower()}",
                             finished_at=now.isoformat(), cost_usd=status.cost_usd)

    async def _finalize(self, user_id: str, search_id: str, run: dict[str, Any], dataset_id: str | None, cost: float | None) -> None:
        if not dataset_id:
            await self._call(self.repository.transition_source_run, user_id, search_id, "linkedin",
                             run["status"], "failed", error_code="no_dataset",
                             finished_at=datetime.now(timezone.utc).isoformat())
            return
        try:
            offers: list[JobListing] = await self.provider.fetch_items(dataset_id)
        except (LinkedInSourceError, LinkedInSourceUnconfigured):
            return
        won = await self._call(self.repository.transition_source_run, user_id, search_id, "linkedin",
                               run["status"], "succeeded", offers_count=len(offers), cost_usd=cost,
                               apify_dataset_id=dataset_id, error_code=None,
                               finished_at=datetime.now(timezone.utc).isoformat())
        if won and offers:
            await self._call(self.repository.upsert_offers, user_id, search_id, offers)

    async def finalize_by_apify_run(self, apify_run_id: str) -> bool:
        """Webhook entry point: finalizes the run if known; safe to call repeatedly."""
        run = await self._call(self.repository.get_source_run_by_apify_id, apify_run_id)
        if not run or run["status"] not in ACTIVE:
            return False
        await self._poll(run["user_id"], run["search_id"], run)
        runs = await self._call(self.repository.list_source_runs, run["user_id"], run["search_id"])
        await self._call(self.repository.update_search_status, run["user_id"], run["search_id"], aggregate_status(runs))
        return True
