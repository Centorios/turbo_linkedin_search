from typing import Any

from supabase import Client

from app.core.supabase import get_admin_client


class ResumeRepository:
    def __init__(self, client: Client | None = None) -> None:
        self.client = client or get_admin_client()

    def get_by_request(self, user_id: str, request_id: str) -> dict[str, Any] | None:
        response = (
            self.client.table("resumes")
            .select("id,user_id,request_id,data,created_at")
            .eq("user_id", user_id)
            .eq("request_id", request_id)
            .maybe_single()
            .execute()
        )
        return response.data if response is not None else None

    def list_by_user(self, user_id: str, offset: int, limit: int) -> list[dict[str, Any]]:
        response = (
            self.client.table("resumes")
            .select("id,data,created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .order("id", desc=True)
            .range(offset, offset + limit)
            .execute()
        )
        # Read one extra row to indicate whether there is another page.
        if response is None or response.data is None:
            raise RuntimeError("Resume history persistence returned no data")
        return response.data

    def get_by_id(self, user_id: str, resume_id: str) -> dict[str, Any] | None:
        response = (
            self.client.table("resumes")
            .select("id,data,created_at")
            .eq("user_id", user_id)
            .eq("id", resume_id)
            .maybe_single()
            .execute()
        )
        return response.data if response is not None else None

    def create(self, user_id: str, request_id: str, data: dict[str, Any]) -> dict[str, Any]:
        response = (
            self.client.table("resumes")
            .insert({"user_id": user_id, "request_id": request_id, "data": data})
            .select("id,user_id,request_id,data,created_at")
            .execute()
        )
        if response is None or response.data is None:
            raise RuntimeError("Resume persistence returned no data")
        if isinstance(response.data, list):
            if not response.data:
                raise RuntimeError("Resume persistence returned no rows")
            return response.data[0]
        return response.data
