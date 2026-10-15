from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.services.cv_import_repository import BUCKET_NAME, CvImportRepository


USER_ID = "00000000-0000-0000-0000-000000000001"
SOURCE_ID = "00000000-0000-0000-0000-000000000011"
RESUME_ID = "00000000-0000-0000-0000-000000000012"
PDF_BYTES = b"%PDF-1.4\nsource"


def make_repository():
    client = MagicMock()
    storage = MagicMock()
    client.storage.from_.return_value = storage
    sources = MagicMock()
    resumes = MagicMock()
    client.table.side_effect = lambda name: {"cv_sources": sources, "resumes": resumes}[name]
    return CvImportRepository(client), client, storage, sources, resumes


def test_import_uses_user_scoped_private_path_and_cleans_up_partial_persistence() -> None:
    repository, _, storage, sources, resumes = make_repository()
    source_row = {
        "id": SOURCE_ID,
        "user_id": USER_ID,
        "storage_path": f"{USER_ID}/{SOURCE_ID}.pdf",
    }
    sources.insert.return_value.select.return_value.single.return_value.execute.return_value = SimpleNamespace(
        data=source_row
    )
    sources.delete.return_value.eq.return_value.eq.return_value.execute.return_value = SimpleNamespace(
        data=[{"id": SOURCE_ID}]
    )
    resumes.insert.return_value.select.return_value.single.return_value.execute.side_effect = RuntimeError(
        "resume insert failed"
    )

    with pytest.raises(RuntimeError, match="resume insert failed"):
        repository.create_import(
            USER_ID,
            "00000000-0000-0000-0000-000000000010",
            SOURCE_ID,
            "cv.pdf",
            PDF_BYTES,
            1,
            {"summary": "CV"},
        )

    client_bucket = repository.client.storage.from_.call_args.args[0]
    assert client_bucket == BUCKET_NAME
    storage.upload.assert_called_once_with(
        f"{USER_ID}/{SOURCE_ID}.pdf",
        PDF_BYTES,
        file_options={"content-type": "application/pdf", "upsert": "false"},
    )
    assert sources.insert.call_args.args[0]["storage_path"] == f"{USER_ID}/{SOURCE_ID}.pdf"
    storage.remove.assert_called_once_with([f"{USER_ID}/{SOURCE_ID}.pdf"])
    sources.delete.return_value.eq.return_value.eq.return_value.execute.assert_called_once()


def test_source_deletion_restores_pdf_when_database_delete_fails() -> None:
    repository, _, storage, sources, _ = make_repository()
    sources.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = (
        SimpleNamespace(data={"storage_path": f"{USER_ID}/{SOURCE_ID}.pdf"})
    )
    storage.download.return_value = PDF_BYTES
    sources.delete.return_value.eq.return_value.eq.return_value.select.return_value.execute.side_effect = RuntimeError(
        "database delete failed"
    )

    with pytest.raises(RuntimeError, match="database delete failed"):
        repository.delete_source(USER_ID, SOURCE_ID)

    storage.remove.assert_called_once_with([f"{USER_ID}/{SOURCE_ID}.pdf"])
    storage.upload.assert_called_once_with(
        f"{USER_ID}/{SOURCE_ID}.pdf",
        PDF_BYTES,
        file_options={"content-type": "application/pdf", "upsert": "false"},
    )


def test_source_deletion_removes_private_pdf_and_source_row() -> None:
    repository, _, storage, sources, _ = make_repository()
    sources.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = (
        SimpleNamespace(data={"storage_path": f"{USER_ID}/{SOURCE_ID}.pdf"})
    )
    storage.download.return_value = PDF_BYTES
    sources.delete.return_value.eq.return_value.eq.return_value.select.return_value.execute.return_value = (
        SimpleNamespace(data=[{"id": SOURCE_ID}])
    )

    assert repository.delete_source(USER_ID, SOURCE_ID) is True

    storage.remove.assert_called_once_with([f"{USER_ID}/{SOURCE_ID}.pdf"])
    sources.delete.return_value.eq.return_value.eq.return_value.select.return_value.execute.assert_called_once()
    storage.upload.assert_not_called()


def test_version_retry_is_idempotent_and_conflicting_reuse_is_rejected() -> None:
    repository, _, _, _, resumes = make_repository()
    existing = {
        "id": RESUME_ID,
        "source_id": SOURCE_ID,
        "parent_resume_id": "00000000-0000-0000-0000-000000000013",
        "data": {"summary": "guardado"},
    }
    lookup = resumes.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute
    lookup.return_value = SimpleNamespace(data=existing)

    repeated = repository.create_version(
        USER_ID,
        SOURCE_ID,
        "00000000-0000-0000-0000-000000000014",
        existing["parent_resume_id"],
        existing["data"],
    )
    assert repeated == existing
    resumes.insert.assert_not_called()

    with pytest.raises(ValueError, match="different version"):
        repository.create_version(
            USER_ID,
            "00000000-0000-0000-0000-000000000099",
            "00000000-0000-0000-0000-000000000014",
            existing["parent_resume_id"],
            existing["data"],
        )
