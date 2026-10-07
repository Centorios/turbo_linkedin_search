import asyncio
import logging
import time
from datetime import datetime
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlparse

import httpx

from app.models.jobs import JobListing


logger = logging.getLogger(__name__)
JOOBLE_AR_URL = "https://ar.jooble.org/api/"
CACHE_SECONDS = 60 * 60


class JobSourceUnconfigured(Exception):
    pass


class JobSourceError(Exception):
    pass


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def _plain_text(value: Any, limit: int = 500) -> str:
    if not isinstance(value, str):
        return ""
    parser = _TextExtractor()
    parser.feed(value)
    return " ".join(" ".join(parser.parts).split())[:limit]


def _updated_at(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def normalize_jobs(payload: Any) -> list[JobListing]:
    if not isinstance(payload, dict) or not isinstance(payload.get("jobs"), list):
        raise JobSourceError()
    jobs: list[JobListing] = []
    seen: set[str] = set()
    for row in payload["jobs"]:
        if not isinstance(row, dict):
            continue
        raw_id = row.get("id")
        title = _plain_text(row.get("title"), 200)
        link = row.get("link")
        if raw_id is None or isinstance(raw_id, bool) or not title or not isinstance(link, str):
            continue
        parsed = urlparse(link.strip())
        host = parsed.hostname or ""
        if parsed.scheme != "https" or not (host == "jooble.org" or host.endswith(".jooble.org")) or parsed.username or parsed.password or any(char in link for char in "\r\n\t"):
            continue
        job_id = f"jooble:{raw_id}"
        if job_id in seen:
            continue
        seen.add(job_id)
        jobs.append(JobListing(
            id=job_id,
            title=title,
            company=_plain_text(row.get("company"), 150),
            location=_plain_text(row.get("location"), 150),
            snippet=_plain_text(row.get("snippet")),
            url=link.strip(),
            source="Jooble",
            updatedAt=_updated_at(row.get("updated")),
        ))
        if len(jobs) == 20:
            break
    return jobs


class JoobleJobsProvider:
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key.strip()
        self._cache: dict[tuple[str, str], tuple[float, list[JobListing]]] = {}
        self._lock = asyncio.Lock()

    async def search(self, keywords: str, location: str) -> list[JobListing]:
        if not self.api_key:
            raise JobSourceUnconfigured()
        cache_key = (keywords.casefold(), location.casefold())
        async with self._lock:
            cached = self._cache.get(cache_key)
            if cached and cached[0] > time.monotonic():
                return list(cached[1])
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        f"{JOOBLE_AR_URL}{self.api_key}",
                        json={"keywords": keywords, "location": location, "page": 1, "ResultOnPage": 20, "companysearch": False},
                        headers={"Accept": "application/json"},
                    )
                    response.raise_for_status()
                    jobs = normalize_jobs(response.json())
            except (httpx.HTTPError, ValueError, JobSourceError) as exc:
                logger.warning("jooble_search_failed", extra={"error_type": type(exc).__name__})
                raise JobSourceError() from exc
            self._cache[cache_key] = (time.monotonic() + CACHE_SECONDS, jobs)
            if len(self._cache) > 100:
                oldest = min(self._cache, key=lambda key: self._cache[key][0])
                del self._cache[oldest]
            return list(jobs)
