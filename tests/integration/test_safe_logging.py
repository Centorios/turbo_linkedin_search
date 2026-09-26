import logging

from fastapi.testclient import TestClient

from app.api.generate_cv import get_generation_service
from app.core.auth import require_user_id
from app.main import app
from app.services.cv_generation import CvGenerationService
from tests.contract.test_generate_cv import FakeProvider, FakeRepository


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_request_logs_include_safe_metadata_without_user_or_secret_data(caplog) -> None:
    private_text = "PRIVATE_CV_TEXT"
    private_token = "PRIVATE_ACCESS_TOKEN"
    app.dependency_overrides[require_user_id] = lambda: "user-1"
    app.dependency_overrides[get_generation_service] = lambda: CvGenerationService(
        provider=FakeProvider(),
        repository=FakeRepository(),
    )
    caplog.set_level(logging.INFO, logger="cv8.request")
    client = TestClient(app)

    response = client.post(
        "/api/generate-cv",
        headers={
            "Authorization": f"Bearer {private_token}",
            "Idempotency-Key": "00000000-0000-0000-0000-000000000011",
        },
        json={"text": private_text},
    )

    request_logs = [record for record in caplog.records if record.name == "cv8.request"]
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    assert len(request_logs) == 1
    record = request_logs[0]
    assert record.request_id == response.headers["X-Request-ID"]
    assert record.outcome_code == "success"
    assert record.status_code == 200
    assert record.latency_ms >= 0
    assert private_text not in record.getMessage()
    assert private_token not in record.getMessage()
    assert private_text not in repr(record.__dict__)
    assert private_token not in repr(record.__dict__)


def test_provider_exception_logs_do_not_include_provider_error(caplog) -> None:
    private_error = "PRIVATE_PROVIDER_ERROR"
    app.dependency_overrides[require_user_id] = lambda: "user-1"
    app.dependency_overrides[get_generation_service] = lambda: CvGenerationService(
        provider=FakeProvider(error=RuntimeError(private_error)),
        repository=FakeRepository(),
    )
    caplog.set_level(logging.ERROR)
    client = TestClient(app)

    response = client.post(
        "/api/generate-cv",
        headers={
            "Authorization": "Bearer PRIVATE_ACCESS_TOKEN",
            "Idempotency-Key": "00000000-0000-0000-0000-000000000012",
        },
        json={"text": "PRIVATE_CV_TEXT"},
    )

    assert response.status_code == 500
    assert private_error not in caplog.text