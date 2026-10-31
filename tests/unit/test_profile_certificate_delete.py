from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.services.profile_certificate_repository import ProfileCertificateRepository


USER = "00000000-0000-0000-0000-000000000001"
CERTIFICATE = "00000000-0000-0000-0000-000000000002"
ROW = {"id": CERTIFICATE, "user_id": USER, "storage_path": f"{USER}/{CERTIFICATE}.pdf",
       "mime_type": "application/pdf"}


def repository_with_row(row=ROW):
    client = MagicMock()
    query = client.table.return_value
    query.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = SimpleNamespace(data=row)
    query.delete.return_value.eq.return_value.eq.return_value.select.return_value.execute.return_value = SimpleNamespace(data=[{"id": CERTIFICATE}])
    storage = client.storage.from_.return_value
    storage.download.return_value = b"%PDF-test"
    return ProfileCertificateRepository(client=client), query, storage


def test_delete_removes_owned_file_and_metadata():
    repository, query, storage = repository_with_row()
    assert repository.delete(USER, CERTIFICATE)
    storage.remove.assert_called_once_with([ROW["storage_path"]])
    query.delete.assert_called_once()


def test_delete_does_not_touch_a_missing_or_foreign_certificate():
    repository, query, storage = repository_with_row(None)
    assert not repository.delete(USER, CERTIFICATE)
    storage.remove.assert_not_called()
    query.delete.assert_not_called()


def test_delete_restores_file_if_metadata_delete_fails():
    repository, query, storage = repository_with_row()
    query.delete.return_value.eq.return_value.eq.return_value.select.return_value.execute.side_effect = RuntimeError("db down")
    with pytest.raises(RuntimeError, match="db down"):
        repository.delete(USER, CERTIFICATE)
    storage.upload.assert_called_once_with(ROW["storage_path"], b"%PDF-test",
                                           file_options={"content-type": "application/pdf", "upsert": "false"})
