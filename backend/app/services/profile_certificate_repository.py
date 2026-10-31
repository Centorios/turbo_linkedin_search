from typing import Any
import logging

from supabase import Client

from app.core.supabase import get_admin_client


BUCKET_NAME = "user-certificates"
logger = logging.getLogger(__name__)


class CertificateRegistrationConflictError(Exception):
    pass


class ProfileCertificateRepository:
    def __init__(self, client: Client | None = None) -> None:
        self.client = client or get_admin_client()

    def get(self, user_id: str, certificate_id: str) -> dict[str, Any] | None:
        response = (self.client.table("user_certificates").select("*")
                    .eq("user_id", user_id).eq("id", certificate_id).maybe_single().execute())
        return response.data if response is not None else None

    def get_by_request(self, user_id: str, request_id: str) -> dict[str, Any] | None:
        response = (self.client.table("user_certificates").select("*")
                    .eq("user_id", user_id).eq("request_id", request_id).maybe_single().execute())
        return response.data if response is not None else None

    def get_by_hash(self, user_id: str, digest: str) -> dict[str, Any] | None:
        response = (self.client.table("user_certificates").select("*")
                    .eq("user_id", user_id).eq("content_sha256", digest).maybe_single().execute())
        return response.data if response is not None else None

    def list(self, user_id: str, offset: int = 0, limit: int = 50) -> list[dict[str, Any]]:
        response = (self.client.table("user_certificates").select("*")
                    .eq("user_id", user_id).order("created_at", desc=True)
                    .range(offset, offset + limit).execute())
        return response.data or []

    def create(self, record: dict[str, Any], content: bytes) -> tuple[dict[str, Any], bool]:
        storage = self.client.storage.from_(BUCKET_NAME)
        storage.upload(record["storage_path"], content,
                       file_options={"content-type": record["mime_type"], "upsert": "false"})
        try:
            result = self.client.rpc("register_user_certificate", {"p_record": record}).execute()
            row = result.data[0] if isinstance(result.data, list) else result.data
            if not isinstance(row, dict):
                raise RuntimeError("Certificate registration returned no row")
            if row["request_id"] == record["request_id"] and row["content_sha256"] != record["content_sha256"]:
                raise CertificateRegistrationConflictError()
            duplicate = row["id"] != record["id"]
            if duplicate:
                try:
                    storage.remove([record["storage_path"]])
                except Exception as exc:
                    logger.error("certificate_duplicate_cleanup_failed", extra={"error_type": type(exc).__name__})
            return row, duplicate
        except Exception:
            try:
                storage.remove([record["storage_path"]])
            except Exception as exc:
                logger.error("certificate_cleanup_failed", extra={"error_type": type(exc).__name__})
            raise

    def update_pending(self, user_id: str, certificate_id: str, values: dict[str, Any]) -> dict[str, Any] | None:
        response = (self.client.table("user_certificates").update(values)
                    .eq("user_id", user_id).eq("id", certificate_id)
                    .eq("status", "pending_review").select("*").execute())
        data = response.data if response is not None else None
        return data[0] if isinstance(data, list) and data else None

    def download(self, user_id: str, certificate_id: str) -> tuple[bytes, dict[str, Any]] | None:
        row = self.get(user_id, certificate_id)
        if row is None:
            return None
        content = self.client.storage.from_(BUCKET_NAME).download(row["storage_path"])
        if not isinstance(content, bytes):
            raise RuntimeError("Certificate download returned invalid data")
        return content, row

    def delete(self, user_id: str, certificate_id: str) -> bool:
        row = self.get(user_id, certificate_id)
        if row is None:
            return False
        storage = self.client.storage.from_(BUCKET_NAME)
        # Keep a copy so a database failure does not leave a row pointing to a missing file.
        content = storage.download(row["storage_path"])
        if not isinstance(content, bytes):
            raise RuntimeError("Certificate download returned invalid data")
        storage.remove([row["storage_path"]])
        try:
            response = (self.client.table("user_certificates").delete()
                        .eq("user_id", user_id).eq("id", certificate_id).select("id").execute())
            if not response.data:
                raise RuntimeError("Certificate metadata was not deleted")
        except Exception:
            try:
                storage.upload(row["storage_path"], content,
                               file_options={"content-type": row["mime_type"], "upsert": "false"})
            except Exception as exc:
                logger.error("certificate_delete_restore_failed", extra={"error_type": type(exc).__name__})
            raise
        return True
