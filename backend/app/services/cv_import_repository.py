import logging
from typing import Any

from supabase import Client

from app.core.supabase import get_admin_client


logger = logging.getLogger(__name__)
BUCKET_NAME = "cv-sources"


def _inserted_row(response: Any) -> dict[str, Any] | None:
    """Returns the inserted row. postgrest's insert() has no .single(), so the
    representation comes back as a one-item list."""
    data = getattr(response, "data", None)
    if isinstance(data, list):
        return data[0] if data and isinstance(data[0], dict) else None
    return data if isinstance(data, dict) else None


class CvImportRepository:
    def __init__(self, client: Client | None = None) -> None:
        self.client = client or get_admin_client()

    def get_import_by_request(self, user_id: str, request_id: str) -> dict[str, Any] | None:
        source_response = (
            self.client.table("cv_sources")
            .select("*")
            .eq("user_id", user_id)
            .eq("request_id", request_id)
            .maybe_single()
            .execute()
        )
        source = source_response.data if source_response is not None else None
        if source is None:
            return None
        resume_response = (
            self.client.table("resumes")
            .select("id,user_id,source_id,parent_resume_id,data,request_fingerprint,certificate_merge_report,created_at")
            .eq("user_id", user_id)
            .eq("source_id", source["id"])
            .order("created_at")
            .limit(1)
            .execute()
        )
        resume = self._first(resume_response.data if resume_response is not None else None)
        if resume is None:
            raise RuntimeError("CV import source has no initial resume")
        return {"source": source, "resume": resume}

    def create_import(
        self,
        user_id: str,
        request_id: str,
        source_id: str,
        filename: str,
        file_bytes: bytes,
        page_count: int,
        data: dict[str, Any],
    ) -> dict[str, Any]:
        storage_path = f"{user_id}/{source_id}.pdf"
        uploaded = False
        source_created = False
        try:
            self.client.storage.from_(BUCKET_NAME).upload(
                storage_path,
                file_bytes,
                file_options={"content-type": "application/pdf", "upsert": "false"},
            )
            uploaded = True
            source_response = (
                self.client.table("cv_sources")
                .insert(
                    {
                        "id": source_id,
                        "user_id": user_id,
                        "request_id": request_id,
                        "storage_path": storage_path,
                        "original_filename": filename,
                        "file_size_bytes": len(file_bytes),
                        "page_count": page_count,
                    }
                )
                .select("*")
                .execute()
            )
            source = _inserted_row(source_response)
            if source is None:
                raise RuntimeError("CV import source persistence returned no row")
            source_created = True
            resume_response = (
                self.client.table("resumes")
                .insert(
                    {
                        "user_id": user_id,
                        "request_id": request_id,
                        "source_id": source_id,
                        "parent_resume_id": None,
                        "data": data,
                    }
                )
                .select("id,user_id,source_id,parent_resume_id,data,created_at")
                .execute()
            )
            resume = _inserted_row(resume_response)
            if resume is None:
                raise RuntimeError("CV import resume persistence returned no row")
            return {"source": source, "resume": resume}
        except Exception as exc:
            logger.error("cv_import_persistence_failed", extra={"error_type": type(exc).__name__})
            if source_created:
                try:
                    self.client.table("cv_sources").delete().eq("id", source_id).eq("user_id", user_id).execute()
                except Exception as cleanup_exc:
                    logger.critical("cv_import_source_cleanup_failed", extra={"error_type": type(cleanup_exc).__name__})
            if uploaded:
                try:
                    self.client.storage.from_(BUCKET_NAME).remove([storage_path])
                except Exception as cleanup_exc:
                    logger.critical("cv_import_file_cleanup_failed", extra={"error_type": type(cleanup_exc).__name__})
            raise

    def get_source(self, user_id: str, source_id: str) -> dict[str, Any] | None:
        response = (
            self.client.table("cv_sources")
            .select("*")
            .eq("user_id", user_id)
            .eq("id", source_id)
            .maybe_single()
            .execute()
        )
        return response.data if response is not None else None

    def get_resume(self, user_id: str, resume_id: str) -> dict[str, Any] | None:
        response = (
            self.client.table("resumes")
            .select("id,user_id,source_id,parent_resume_id,data,request_fingerprint,certificate_merge_report,created_at")
            .eq("user_id", user_id)
            .eq("id", resume_id)
            .maybe_single()
            .execute()
        )
        return response.data if response is not None else None

    def get_version_by_request(self, user_id: str, request_id: str) -> dict[str, Any] | None:
        response = (self.client.table("resumes")
                    .select("id,user_id,source_id,parent_resume_id,data,request_fingerprint,certificate_merge_report,created_at")
                    .eq("user_id", user_id).eq("request_id", request_id).maybe_single().execute())
        return response.data if response is not None else None

    def create_version(
        self,
        user_id: str,
        source_id: str | None,
        request_id: str,
        parent_resume_id: str,
        data: dict[str, Any],
        request_fingerprint: str | None = None,
        certificate_merge_report: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        existing_response = (
            self.client.table("resumes")
            .select("id,user_id,source_id,parent_resume_id,data,request_fingerprint,certificate_merge_report,created_at")
            .eq("user_id", user_id)
            .eq("request_id", request_id)
            .maybe_single()
            .execute()
        )
        existing = existing_response.data if existing_response is not None else None
        if existing:
            if (existing["source_id"] != source_id or existing["parent_resume_id"] != parent_resume_id
                    or (existing.get("request_fingerprint") and existing["request_fingerprint"] != request_fingerprint)):
                raise ValueError("Idempotency key was already used for a different version")
            return existing

        try:
            response = (
                self.client.table("resumes")
                .insert(
                    {
                        "user_id": user_id,
                        "request_id": request_id,
                        "source_id": source_id,
                        "parent_resume_id": parent_resume_id,
                        "data": data,
                        "request_fingerprint": request_fingerprint,
                        "certificate_merge_report": certificate_merge_report,
                    }
                )
                .select("id,user_id,source_id,parent_resume_id,data,request_fingerprint,certificate_merge_report,created_at")
                .execute()
            )
        except Exception:
            existing = self.get_version_by_request(user_id, request_id)
            if existing is None:
                raise
            if (existing["source_id"] != source_id or existing["parent_resume_id"] != parent_resume_id
                    or (existing.get("request_fingerprint") and existing["request_fingerprint"] != request_fingerprint)):
                raise ValueError("Idempotency key was already used for a different version")
            return existing
        version = _inserted_row(response)
        if version is None:
            raise RuntimeError("CV version persistence returned no row")
        return version

    def download_source(self, user_id: str, source_id: str) -> tuple[bytes, str] | None:
        source = self.get_source(user_id, source_id)
        if source is None:
            return None
        file_bytes = self.client.storage.from_(BUCKET_NAME).download(source["storage_path"])
        if not isinstance(file_bytes, bytes):
            raise RuntimeError("CV source download returned an invalid body")
        return file_bytes, source["original_filename"]

    def delete_source(self, user_id: str, source_id: str) -> bool:
        source = self.get_source(user_id, source_id)
        if source is None:
            return False
        storage = self.client.storage.from_(BUCKET_NAME)
        file_bytes = storage.download(source["storage_path"])
        storage.remove([source["storage_path"]])
        try:
            response = (
                self.client.table("cv_sources")
                .delete()
                .eq("user_id", user_id)
                .eq("id", source_id)
                .select("id")
                .execute()
            )
            if response is None or not response.data:
                storage.upload(
                    source["storage_path"],
                    file_bytes,
                    file_options={"content-type": "application/pdf", "upsert": "false"},
                )
                return False
        except Exception as exc:
            try:
                storage.upload(
                    source["storage_path"],
                    file_bytes,
                    file_options={"content-type": "application/pdf", "upsert": "false"},
                )
            except Exception as restore_exc:
                logger.critical(
                    "cv_import_source_restore_failed",
                    extra={"error_type": type(restore_exc).__name__},
                )
            logger.error("cv_import_source_delete_failed", extra={"error_type": type(exc).__name__})
            raise
        return True

    @staticmethod
    def _first(value: Any) -> dict[str, Any] | None:
        if isinstance(value, list):
            return value[0] if value else None
        return value if isinstance(value, dict) else None
