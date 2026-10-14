import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from supabase import Client

from app.core.supabase import get_admin_client


def resume_content_hash(data: dict[str, Any]) -> str:
    canonical = json.dumps(data, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class MatchRepository:
    def __init__(self, client: Client | None = None) -> None:
        self.client = client or get_admin_client()

    def get_resume_embedding(self, user_id: str, resume_id: str) -> dict[str, Any] | None:
        response = (
            self.client.table("resume_embeddings")
            .select("resume_id,content_hash,model,embedding")
            .eq("user_id", user_id)
            .eq("resume_id", resume_id)
            .maybe_single()
            .execute()
        )
        return response.data if response is not None else None

    def save_resume_embedding(
        self,
        user_id: str,
        resume_id: str,
        content_hash: str,
        model: str,
        embedding: list[float],
    ) -> None:
        self.client.table("resume_embeddings").upsert(
            {
                "resume_id": resume_id,
                "user_id": user_id,
                "content_hash": content_hash,
                "model": model,
                "embedding": embedding,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="resume_id",
        ).execute()

    def match_candidates(self, search_id: str, resume_id: str, k: int) -> list[dict[str, Any]]:
        response = self.client.rpc(
            "match_candidates",
            {"p_search_id": search_id, "p_resume_id": resume_id, "p_k": k},
        ).execute()
        return (response.data if response is not None else None) or []

    def try_lock(self, search_id: str, resume_id: str) -> bool:
        response = self.client.rpc(
            "try_lock_match", {"p_search_id": search_id, "p_resume_id": resume_id}
        ).execute()
        return bool(response.data) if response is not None else False

    def release_lock(self, search_id: str, resume_id: str) -> None:
        self.client.rpc(
            "release_match_lock", {"p_search_id": search_id, "p_resume_id": resume_id}
        ).execute()

    def save_result(
        self,
        user_id: str,
        search_id: str,
        resume_id: str,
        resume_hash: str,
        recommendations: list[dict[str, Any]],
    ) -> None:
        self.client.rpc(
            "save_match_result",
            {
                "p_user_id": user_id,
                "p_search_id": search_id,
                "p_resume_id": resume_id,
                "p_resume_content_hash": resume_hash,
                "p_recommendations": recommendations,
            },
        ).execute()

    def get_saved_result(
        self, user_id: str, search_id: str, resume_id: str
    ) -> dict[str, Any] | None:
        result = (
            self.client.table("match_results")
            .select("id,resume_content_hash,created_at")
            .eq("user_id", user_id)
            .eq("search_id", search_id)
            .eq("resume_id", resume_id)
            .maybe_single()
            .execute()
        )
        if result is None or not result.data:
            return None
        recs = (
            self.client.table("match_recommendations")
            .select(
                "rank,offer_id,affinity,summary,matches,unmet_requirements,missing_info,"
                "job_search_offers(title,company,location,url,source,alternate_urls,description_is_partial)"
            )
            .eq("user_id", user_id)
            .eq("result_id", result.data["id"])
            .order("rank")
            .execute()
        )
        return {**result.data, "recommendations": (recs.data if recs is not None else None) or []}
