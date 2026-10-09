import asyncio

import httpx
import pytest

from app.services import apify_linkedin
from app.services.apify_linkedin import (
    ApifyLinkedInProvider,
    LinkedInSourceError,
    LinkedInSourceUnconfigured,
    normalize_items,
)


@pytest.fixture
def apify_items():
    return [
        {"id": "111", "title": "Backend Developer", "jobUrl": "https://www.linkedin.com/jobs/view/111",
         "descriptionText": "Descripción completa del puesto. " * 20, "companyName": "Acme", "location": "Buenos Aires"},
        {"id": "111", "title": "Duplicada", "jobUrl": "https://www.linkedin.com/jobs/view/111"},
        {"id": "222", "title": "Fuera de LinkedIn", "jobUrl": "https://evil.example.com/jobs/222"},
        {"id": "333", "title": "Sin URL"},
        {"id": "444", "title": "Insegura", "jobUrl": "http://www.linkedin.com/jobs/view/444"},
    ]


def provider_with(monkeypatch, handler, token="t0k3n"):
    transport = httpx.MockTransport(handler)
    real = httpx.AsyncClient
    monkeypatch.setattr(apify_linkedin.httpx, "AsyncClient", lambda **kw: real(transport=transport, **kw))
    return ApifyLinkedInProvider(token, "bebity/linkedin-jobs-scraper")


def test_normalize_items_filters_invalid_and_duplicates(apify_items):
    jobs = normalize_items(apify_items)
    assert [j.id for j in jobs] == ["linkedin:111"]
    assert jobs[0].sources == ["linkedin"]
    assert jobs[0].source == "LinkedIn"


def test_normalize_items_rejects_non_list():
    with pytest.raises(LinkedInSourceError):
        normalize_items({"error": "x"})


def test_provider_start_get_run_and_fetch(monkeypatch, apify_items):
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.method, request.url.path, request.headers.get("authorization")))
        if request.method == "POST" and request.url.path.endswith("/runs"):
            assert "~" in request.url.path
            assert request.url.params["maxTotalChargeUsd"] == "0.1"
            return httpx.Response(201, json={"data": {"id": "run1", "defaultDatasetId": "ds1"}})
        if request.url.path.endswith("/actor-runs/run1"):
            return httpx.Response(200, json={"data": {"status": "SUCCEEDED", "defaultDatasetId": "ds1", "usageTotalUsd": 0.02}})
        if request.url.path.endswith("/datasets/ds1/items"):
            return httpx.Response(200, json=apify_items)
        return httpx.Response(404)

    provider = provider_with(monkeypatch, handler)
    handle = asyncio.run(provider.start("python", "Argentina"))
    assert (handle.run_id, handle.dataset_id) == ("run1", "ds1")
    status = asyncio.run(provider.get_run("run1"))
    assert status.status == "SUCCEEDED" and status.cost_usd == 0.02
    assert len(asyncio.run(provider.fetch_items("ds1"))) == 1
    assert all(auth == "Bearer t0k3n" for _, _, auth in seen)


def test_provider_unconfigured_raises():
    provider = ApifyLinkedInProvider("", "actor")
    assert not provider.configured
    with pytest.raises(LinkedInSourceUnconfigured):
        asyncio.run(provider.start("python", "AR"))


def test_provider_http_error_is_wrapped_without_leaking_token(monkeypatch):
    provider = provider_with(monkeypatch, lambda request: httpx.Response(500, text="boom t0k3n"))
    with pytest.raises(LinkedInSourceError) as exc:
        asyncio.run(provider.get_run("run1"))
    assert "t0k3n" not in str(exc.value)


def test_abort_swallows_errors(monkeypatch):
    provider = provider_with(monkeypatch, lambda request: httpx.Response(500))
    asyncio.run(provider.abort("run1"))


