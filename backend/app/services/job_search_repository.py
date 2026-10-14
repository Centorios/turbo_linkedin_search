import hashlib
from typing import Any

from supabase import Client

from app.core.supabase import get_admin_client
from app.models.jobs import JobListing


def offer_content_hash(offer: JobListing | dict[str, Any]) -> str:
    if isinstance(offer, JobListing):
        values = [offer.title, offer.company, offer.location, offer.snippet]
        description = offer.description
    else:
        values = [offer["title"], offer["company"], offer["location"], offer["snippet"]]
        description = offer.get("description")
    if description:
        values.append(description)
    text = "\n".join(values)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _offer_row(
    search_id: str, user_id: str, position: int, dedup_key: str, offer: JobListing
) -> dict[str, Any]:
    return {
        "search_id": search_id,
        "user_id": user_id,
        "position": position,
        "external_id": offer.id,
        "dedup_key": dedup_key,
        "title": offer.title,
        "company": offer.company,
        "location": offer.location,
        "snippet": offer.snippet,
        "description": offer.description,
        "description_is_partial": offer.descriptionIsPartial,
        "url": offer.url,
        "source": offer.source,
        "sources": offer.sources or [offer.source.lower()],
        "alternate_urls": [alt.model_dump() for alt in offer.alternateUrls],
        "source_updated_at": offer.updatedAt.isoformat() if offer.updatedAt else None,
        "content_hash": offer_content_hash(offer),
    }


class JobSearchRepository:
    def __init__(self, client: Client | None = None) -> None:
        self.client = client or get_admin_client()

    def create_search(
        self,
        user_id: str,
        resume_id: str,
        keywords: str,
        location: str,
        offers: list[JobListing],
        sources: list[str] | None = None,
        status: str = "complete",
    ) -> str:
        response = (
            self.client.table("job_searches")
            .insert(
                {
                    "user_id": user_id,
                    "resume_id": resume_id,
                    "keywords": keywords,
                    "location": location,
                    "sources": sources or ["jooble"],
                    "status": status,
                }
            )
            .select("id")
            .execute()
        )
        if response is None or not response.data:
            raise RuntimeError("Job search persistence returned no data")
        search_id = response.data[0]["id"]
        if offers:
            self.upsert_offers(user_id, search_id, offers)
        return search_id

    def upsert_offers(self, user_id: str, search_id: str, offers: list[JobListing]) -> None:
        """Persist offers deduplicated by key; idempotent per (search_id, dedup_key)."""
        from app.services.job_normalizer import deduplicate_listings

        existing = self.list_offers(user_id, search_id)
        next_position = max((int(row.get("position", 0)) for row in existing), default=-1) + 1
        existing_keys = {row.get("dedup_key") for row in existing if row.get("dedup_key")}
        rows = []
        for key, offer in deduplicate_listings(offers):
            position = next_position
            if key not in existing_keys:
                next_position += 1
            rows.append(_offer_row(search_id, user_id, position, key, offer))
        if rows:
            self.client.table("job_search_offers").upsert(
                rows, on_conflict="search_id,dedup_key"
            ).execute()

    def update_search_status(self, user_id: str, search_id: str, status: str) -> None:
        self.client.table("job_searches").update({"status": status}).eq("user_id", user_id).eq(
            "id", search_id
        ).execute()

    def create_source_run(
        self, user_id: str, search_id: str, source: str, status: str = "pending", **fields: Any
    ) -> None:
        self.client.table("job_search_source_runs").upsert(
            {"search_id": search_id, "user_id": user_id, "source": source, "status": status, **fields},
            on_conflict="search_id,source",
        ).execute()

    def get_source_run(self, user_id: str, search_id: str, source: str) -> dict[str, Any] | None:
        response = (
            self.client.table("job_search_source_runs")
            .select("*")
            .eq("user_id", user_id)
            .eq("search_id", search_id)
            .eq("source", source)
            .maybe_single()
            .execute()
        )
        return response.data if response is not None else None

    def get_source_run_by_apify_id(self, apify_run_id: str) -> dict[str, Any] | None:
        response = (
            self.client.table("job_search_source_runs")
            .select("*")
            .eq("apify_run_id", apify_run_id)
            .maybe_single()
            .execute()
        )
        return response.data if response is not None else None

    def list_source_runs(self, user_id: str, search_id: str) -> list[dict[str, Any]]:
        response = (
            self.client.table("job_search_source_runs")
            .select("*")
            .eq("user_id", user_id)
            .eq("search_id", search_id)
            .execute()
        )
        return (response.data if response is not None else None) or []

    def transition_source_run(
        self,
        user_id: str,
        search_id: str,
        source: str,
        expected_status: str,
        new_status: str,
        **fields: Any,
    ) -> bool:
        """Conditional state change; returns True only for the caller that won the transition."""
        response = (
            self.client.table("job_search_source_runs")
            .update({"status": new_status, **fields})
            .eq("user_id", user_id)
            .eq("search_id", search_id)
            .eq("source", source)
            .eq("status", expected_status)
            .execute()
        )
        return bool(response is not None and response.data)

    def get_search(self, user_id: str, search_id: str) -> dict[str, Any] | None:
        response = (
            self.client.table("job_searches")
            .select("id,user_id,resume_id,keywords,location,sources,status,created_at")
            .eq("user_id", user_id)
            .eq("id", search_id)
            .maybe_single()
            .execute()
        )
        return response.data if response is not None else None

    def list_offers(self, user_id: str, search_id: str) -> list[dict[str, Any]]:
        response = (
            self.client.table("job_search_offers")
            .select(
                "id,position,external_id,dedup_key,title,company,location,snippet,description,"
                "description_is_partial,url,source,sources,alternate_urls,source_updated_at,"
                "content_hash,embedding"
            )
            .eq("user_id", user_id)
            .eq("search_id", search_id)
            .order("position")
            .execute()
        )
        return (response.data if response is not None else None) or []

    def save_offer_embeddings(self, vectors: dict[str, list[float]]) -> None:
        for offer_id, embedding in vectors.items():
            self.client.table("job_search_offers").update({"embedding": embedding}).eq(
                "id", offer_id
            ).execute()
