from typing import Any

from supabase import Client

from app.core.supabase import get_admin_client


class ProfileRepository:
    def __init__(self, client: Client | None = None) -> None:
        self.client = client or get_admin_client()

    def get_by_user(self, user_id: str) -> dict[str, str] | None:
        response = (
            self.client.table("basic_profiles")
            .select("full_name,email,phone,location,linkedin,website")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if response is None or response.data is None:
            return None
        return self._to_profile(response.data)

    def upsert(self, user_id: str, profile: dict[str, str]) -> dict[str, str]:
        data = {
            "user_id": user_id,
            "full_name": profile["fullName"],
            "email": profile["email"],
            "phone": profile["phone"],
            "location": profile["location"],
            "linkedin": profile["linkedin"],
            "website": profile["website"],
        }
        response = (
            self.client.table("basic_profiles")
            .upsert(data, on_conflict="user_id")
            .select("full_name,email,phone,location,linkedin,website")
            .single()
            .execute()
        )
        if response is None or response.data is None:
            raise RuntimeError("Profile persistence returned no data")
        return self._to_profile(response.data)

    @staticmethod
    def _to_profile(data: dict[str, Any]) -> dict[str, str]:
        return {
            "fullName": data["full_name"],
            "email": data["email"],
            "phone": data["phone"],
            "location": data["location"],
            "linkedin": data["linkedin"],
            "website": data["website"],
        }