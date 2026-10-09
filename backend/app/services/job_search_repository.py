import hashlib
from typing import Any

from supabase import Client

from app.core.supabase import get_admin_client
from app.models.jobs import JobListing


def offer_content_hash(offer: JobListing | dict[str, Any]) -> str:
    if isinstance(offer, JobListing):
        values = [offer.title, offer.company, offer.location, offer.snippet]
    else:
        values = [offer["title"], offer["company"], offer["location"], offer["snippet"]]
    text = "\n".join(values)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


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
    ) -> str:
        response = (
            self.client.table("job_searches")
            .insert(
                {
                    "user_id": user_id,
                    "resume_id": resume_id,
                    "keywords": keywords,
                    "location": location,
                }
            )
            .select("id")
            .execute()
        )
        if response is None or not response.data:
            raise RuntimeError("Job search persistence returned no data")
        search_id = response.data[0]["id"]
        if offers:
            rows = [
                {
                    "search_id": search_id,
                    "user_id": user_id,
                    "position": index,
                    "external_id": offer.id,
                    "title": offer.title,
                    "company": offer.company,
                    "location": offer.location,
                    "snippet": offer.snippet,
                    "url": offer.url,
                    "source": offer.source,
                    "source_updated_at": offer.updatedAt.isoformat() if offer.updatedAt else None,
                    "content_hash": offer_content_hash(offer),
                }
                for index, offer in enumerate(offers)
            ]
            self.client.table("job_search_offers").upsert(
                rows, on_conflict="search_id,external_id"
            ).execute()
        return search_id

    def get_search(self, user_id: str, search_id: str) -> dict[str, Any] | None:
        response = (
            self.client.table("job_searches")
            .select("id,user_id,resume_id,keywords,location,created_at")
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
                "id,position,external_id,title,company,location,snippet,url,content_hash,embedding"
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
