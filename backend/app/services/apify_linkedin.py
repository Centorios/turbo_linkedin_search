import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

import httpx

from app.models.jobs import MAX_DESCRIPTION_CHARS, MAX_OFFERS_PER_SOURCE, JobListing
from app.services.job_normalizer import is_partial_description
from app.services.jooble import _plain_text


logger = logging.getLogger(__name__)
APIFY_BASE_URL = "https://api.apify.com/v2"


class LinkedInSourceUnconfigured(Exception):
    pass


class LinkedInSourceError(Exception):
    pass


@dataclass(frozen=True)
class RunHandle:
    run_id: str
    dataset_id: str | None


@dataclass(frozen=True)
class RunStatus:
    status: str
    dataset_id: str | None
    cost_usd: float | None


def _first_str(row: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = row.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _published(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def normalize_items(payload: Any, limit: int = MAX_OFFERS_PER_SOURCE) -> list[JobListing]:
    if not isinstance(payload, list):
        raise LinkedInSourceError()
    jobs: list[JobListing] = []
    seen: set[str] = set()
    for row in payload:
        if not isinstance(row, dict):
            continue
        raw_id = row.get("id") or row.get("jobId")
        title = _plain_text(_first_str(row, "title", "jobTitle"), 200)
        link = _first_str(row, "jobUrl", "link", "url")
        if raw_id is None or isinstance(raw_id, bool) or not title or not link:
            continue
        parsed = urlparse(link)
        host = parsed.hostname or ""
        if parsed.scheme != "https" or not (host == "linkedin.com" or host.endswith(".linkedin.com")) or parsed.username or parsed.password or any(char in link for char in "\r\n\t"):
            continue
        job_id = f"linkedin:{raw_id}"
        if job_id in seen:
            continue
        seen.add(job_id)
        description = _plain_text(_first_str(row, "descriptionText", "description"), MAX_DESCRIPTION_CHARS)
        jobs.append(JobListing(
            id=job_id,
            title=title,
            company=_plain_text(_first_str(row, "companyName", "company"), 150),
            location=_plain_text(_first_str(row, "location"), 150),
            snippet=description[:500],
            description=description or None,
            descriptionIsPartial=is_partial_description(description),
            url=link,
            source="LinkedIn",
            sources=["linkedin"],
            updatedAt=_published(_first_str(row, "publishedAt", "postedAt")),
        ))
        if len(jobs) >= limit:
            break
    return jobs


class ApifyLinkedInProvider:
    def __init__(self, token: str, actor_id: str, max_charge_usd: float = 0.10, max_items: int = MAX_OFFERS_PER_SOURCE) -> None:
        self.token = token.strip()
        self.actor_id = actor_id.strip().replace("/", "~")
        self.max_charge_usd = max_charge_usd
        self.max_items = min(max_items, MAX_OFFERS_PER_SOURCE)

    @property
    def configured(self) -> bool:
        return bool(self.token and self.actor_id)

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        if not self.configured:
            raise LinkedInSourceUnconfigured()
        try:
            async with httpx.AsyncClient(base_url=APIFY_BASE_URL, timeout=15.0) as client:
                response = await client.request(method, path, headers={"Authorization": f"Bearer {self.token}", "Accept": "application/json"}, **kwargs)
                response.raise_for_status()
                return response.json()
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("apify_request_failed", extra={"error_type": type(exc).__name__})
            raise LinkedInSourceError() from exc

    async def start(self, keywords: str, location: str) -> RunHandle:
        body = {"titles": [keywords], "locations": [location], "rows": self.max_items}
        data = await self._request("POST", f"/acts/{self.actor_id}/runs", json=body, params={"maxTotalChargeUsd": self.max_charge_usd})
        run = data.get("data") if isinstance(data, dict) else None
        if not isinstance(run, dict) or not run.get("id"):
            raise LinkedInSourceError()
        return RunHandle(str(run["id"]), run.get("defaultDatasetId"))

    async def get_run(self, run_id: str) -> RunStatus:
        data = await self._request("GET", f"/actor-runs/{run_id}")
        run = data.get("data") if isinstance(data, dict) else None
        if not isinstance(run, dict) or not isinstance(run.get("status"), str):
            raise LinkedInSourceError()
        cost = run.get("usageTotalUsd")
        return RunStatus(run["status"], run.get("defaultDatasetId"), float(cost) if isinstance(cost, (int, float)) else None)

    async def fetch_items(self, dataset_id: str, limit: int | None = None) -> list[JobListing]:
        limit = min(limit or self.max_items, MAX_OFFERS_PER_SOURCE)
        payload = await self._request("GET", f"/datasets/{dataset_id}/items", params={"limit": limit, "clean": "true", "format": "json"})
        return normalize_items(payload, limit)

    async def abort(self, run_id: str) -> None:
        try:
            await self._request("POST", f"/actor-runs/{run_id}/abort")
        except LinkedInSourceError:
            pass
