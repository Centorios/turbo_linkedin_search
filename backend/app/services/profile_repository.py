from typing import Any
from uuid import UUID

from supabase import Client

from app.core.supabase import get_admin_client


class ProfileRepository:
    def __init__(self, client: Client | None = None) -> None:
        self.client = client or get_admin_client()

    def get_by_user(self, user_id: str) -> dict[str, str | None] | None:
        response = (
            self.client.table("basic_profiles")
            .select("full_name,email,phone,location,linkedin,website,photo_path")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if response is None or response.data is None:
            return None
        return self._to_profile(response.data)

    def upsert(self, user_id: str, profile: dict[str, str | None]) -> dict[str, str | None]:
        photo_path = profile.get("photoPath")
        if photo_path is not None:
            parts = photo_path.split("/")
            if len(parts) != 2:
                raise ValueError("Profile photo path must contain an owner folder and file name")
            owner_id, file_name = parts
            file_parts = file_name.rsplit(".", 1)
            if len(file_parts) != 2 or file_parts[1].lower() not in {"jpg", "jpeg", "png", "webp"}:
                raise ValueError("Profile photo path has an unsupported file extension")
            try:
                if UUID(owner_id) != UUID(user_id):
                    raise ValueError("Profile photo path belongs to another user")
                UUID(file_parts[0])
            except ValueError as exc:
                raise ValueError("Profile photo path must use UUID identifiers") from exc

        data = {
            "user_id": user_id,
            "full_name": profile["fullName"],
            "email": profile["email"],
            "phone": profile["phone"],
            "location": profile["location"],
            "linkedin": profile["linkedin"],
            "website": profile["website"],
            "photo_path": photo_path,
        }

        response = (
            self.client.table("basic_profiles")
            .upsert(data, on_conflict="user_id")
            .select("full_name,email,phone,location,linkedin,website,photo_path")
            .execute()
        )
        if response is None or response.data is None:
            raise RuntimeError("Profile persistence returned no data")
        if isinstance(response.data, list):
            if not response.data:
                raise RuntimeError("Profile persistence returned no rows")
            return self._to_profile(response.data[0])
        return self._to_profile(response.data)

    @staticmethod
    def _to_profile(data: dict[str, Any]) -> dict[str, str | None]:
        return {
            "fullName": data["full_name"],
            "email": data["email"],
            "phone": data["phone"],
            "location": data["location"],
            "linkedin": data["linkedin"],
            "website": data["website"],
            "photoPath": data.get("photo_path"),
        }