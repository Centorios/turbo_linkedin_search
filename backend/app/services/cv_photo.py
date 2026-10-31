from uuid import UUID

from supabase import Client
from app.core.supabase import get_admin_client


class InvalidCvPhotoError(Exception):
    pass


def validate_cv_photo(user_id: str, path: str | None, client: Client | None = None) -> None:
    if path is None:
        return
    parts = path.split("/")
    if len(parts) != 2:
        raise InvalidCvPhotoError()
    owner, filename = parts
    pieces = filename.split(".")
    if len(pieces) != 2 or pieces[1].lower() not in {"jpg", "jpeg", "png", "webp"}:
        raise InvalidCvPhotoError()
    try:
        if UUID(owner) != UUID(user_id):
            raise InvalidCvPhotoError()
        UUID(pieces[0])
    except ValueError as exc:
        raise InvalidCvPhotoError() from exc
    storage = (client or get_admin_client()).storage.from_("profile-photos")
    files = storage.list(owner, {"search": filename})
    if not any(item.get("name") == filename for item in files):
        raise InvalidCvPhotoError()
