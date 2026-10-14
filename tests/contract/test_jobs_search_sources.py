from copy import deepcopy
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.api.jobs import get_job_provider, get_job_search_repository, get_orchestrator, get_resume_repository
from app.core.auth import require_user_id
from app.main import app
from app.services.apify_linkedin import ApifyLinkedInProvider, RunHandle, RunStatus, normalize_items
from app.services.job_search_orchestrator import JobSearchOrchestrator
from tests.contract.test_generate_cv import VALID_CV
from tests.contract.test_jobs_api import FakeProvider, FakeRepository


RESUME_ID = str(UUID(int=61))
SEARCH_ID = str(UUID(int=900))


class FakeSearchRepo:
    def __init__(self):
        self.searches = {}
        self.runs = {}
        self.offers = []

    def create_search(self, user_id, resume_id, keywords, location, offers, sources=None, status="complete"):
        self.searches[SEARCH_ID] = {"id": SEARCH_ID, "user_id": user_id, "keywords": keywords, "location": location, "status": status}
        self.offers = [{"external_id": o.id, "title": o.title, "company": o.company, "location": o.location,
                        "snippet": o.snippet, "url": o.url, "source": o.source, "sources": o.sources} for o in offers]
        return SEARCH_ID

    def get_search(self, user_id, search_id):
        row = self.searches.get(search_id)
        return row if row and row["user_id"] == user_id else None

    def update_search_status(self, user_id, search_id, status):
        self.searches[search_id]["status"] = status

    def create_source_run(self, user_id, search_id, source, status="pending", **fields):
        run = self.runs.setdefault((search_id, source), {"search_id": search_id, "source": source, "user_id": user_id, "attempts": 0})
        run.update(fields, status=status)
        return run

    def get_source_run(self, user_id, search_id, source):
        return self.runs.get((search_id, source))

    def get_source_run_by_apify_id(self, apify_run_id):
        return next((r for r in self.runs.values() if r.get("apify_run_id") == apify_run_id), None)

    def list_source_runs(self, user_id, search_id):
        return [r for (s, _), r in self.runs.items() if s == search_id]

    def transition_source_run(self, user_id, search_id, source, expected_status, new_status, **fields):
        run = self.runs[(search_id, source)]
        if run["status"] != expected_status:
            return False
        run.update(fields, status=new_status)
        return True

    def upsert_offers(self, user_id, search_id, offers):
        known = {o["external_id"] for o in self.offers}
        for o in offers:
            if o.id not in known:
                self.offers.append({"external_id": o.id, "title": o.title, "company": o.company, "location": o.location,
                                    "snippet": o.snippet, "url": o.url, "source": o.source, "sources": o.sources})

    def list_offers(self, user_id, search_id):
        return self.offers


class FakeApify(ApifyLinkedInProvider):
    def __init__(self, items, status="SUCCEEDED"):
        super().__init__("token", "actor")
        self.items = items
        self.run_status = status
        self.aborted = []

    async def start(self, keywords, location):
        return RunHandle("run-1", "ds-1")

    async def get_run(self, run_id):
        return RunStatus(self.run_status, "ds-1", 0.05)

    async def fetch_items(self, dataset_id, limit=None):
        return normalize_items(self.items)

    async def abort(self, run_id):
        self.aborted.append(run_id)


def make_client(apify, repo):
    cv = deepcopy(VALID_CV)
    app.dependency_overrides[require_user_id] = lambda: "user-a"
    app.dependency_overrides[get_resume_repository] = lambda: FakeRepository(cv)
    app.dependency_overrides[get_job_provider] = lambda: FakeProvider([])
    app.dependency_overrides[get_job_search_repository] = lambda: repo
    app.dependency_overrides[get_orchestrator] = lambda: JobSearchOrchestrator(repo, apify)
    return TestClient(app)


@pytest.fixture(autouse=True)
def _clear():
    yield
    app.dependency_overrides.clear()


BODY = {"resumeId": RESUME_ID, "keywords": "Python", "location": "Argentina", "sources": ["linkedin"]}


@pytest.fixture
def apify_items():
    return [
        {"id": "111", "title": "Backend Developer", "jobUrl": "https://www.linkedin.com/jobs/view/111",
         "descriptionText": "Descripción completa del puesto. " * 20, "companyName": "Acme", "location": "Buenos Aires"},
        {"id": "222", "title": "Data Engineer", "jobUrl": "https://www.linkedin.com/jobs/view/222",
         "descriptionText": "Corta", "companyName": "Beta", "location": "Remoto"},
    ]


def test_linkedin_search_starts_running_then_status_returns_offers(apify_items):
    repo = FakeSearchRepo()
    client = make_client(FakeApify(apify_items), repo)
    first = client.post("/api/jobs/search", json=BODY)
    assert first.status_code == 200
    assert first.json()["status"] == "in_progress"
    assert first.json()["sources"][0]["status"] == "running"
    status = client.get(f"/api/jobs/search/{SEARCH_ID}/status").json()
    assert status["status"] == "complete"
    assert status["sources"][0]["offersCount"] == 2
    assert status["matchAvailable"] is True
    again = client.get(f"/api/jobs/search/{SEARCH_ID}/status").json()
    assert len(again["items"]) == 2


def test_status_of_foreign_search_is_404(apify_items):
    client = make_client(FakeApify(apify_items), FakeSearchRepo())
    assert client.get(f"/api/jobs/search/{SEARCH_ID}/status").status_code == 404


def test_failed_run_can_be_retried_once_and_conflicts_when_not_applicable(apify_items):
    repo = FakeSearchRepo()
    apify = FakeApify(apify_items, status="FAILED")
    client = make_client(apify, repo)
    client.post("/api/jobs/search", json=BODY)
    assert client.get(f"/api/jobs/search/{SEARCH_ID}/status").json()["status"] == "incomplete"
    apify.run_status = "RUNNING"
    assert client.post(f"/api/jobs/search/{SEARCH_ID}/sources/linkedin/retry").status_code == 202
    assert client.post(f"/api/jobs/search/{SEARCH_ID}/sources/linkedin/retry").status_code == 409


def test_unconfigured_single_source_returns_503():
    repo = FakeSearchRepo()
    client = make_client(ApifyLinkedInProvider("", ""), repo)
    assert client.post("/api/jobs/search", json=BODY).status_code == 503
