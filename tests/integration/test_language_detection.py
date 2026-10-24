import copy

import pytest
from fastapi.testclient import TestClient

from app.api.generate_cv import get_generation_service
from app.core.auth import require_user_id
from app.main import app
from app.services.cv_generation import CvGenerationService
from app.services.language_detection import detect_language
from tests.contract.test_generate_cv import FakeProvider, FakeRepository, VALID_CV

SPANISH = (
    "Soy Juan Pérez, desarrollador junior con experiencia básica en C utilizando Code::Blocks. "
    "Actualmente estudio Desarrollo Web en la UTN y trabajé como carpintero."
)
SPANISH_CV_STYLE = (
    "Ana García, ana@example.com, Madrid. Senior Designer en Acme (03-2021 a la actualidad). "
    "Lideré el rediseño del checkout, reduciendo el abandono un 18%. Educación: Diseño Gráfico en UBA (2015-2019)."
)
ENGLISH = (
    "I am a senior software engineer with five years of experience building web applications. "
    "I led the migration of the billing system and worked with a team of six engineers."
)
PORTUGUESE = (
    "Sou desenvolvedor com experiência em projetos para o setor financeiro. Trabalhei na empresa por "
    "cinco anos e liderei a equipe de produto que foi responsável pela migração."
)


@pytest.mark.parametrize(
    ("text", "expected"),
    [(SPANISH, "Español"), (SPANISH_CV_STYLE, "Español"), (ENGLISH, "Inglés"), (PORTUGUESE, "Portugués")],
)
def test_detects_the_language_the_text_is_written_in(text: str, expected: str) -> None:
    assert detect_language(text) == expected


@pytest.mark.parametrize(
    "text",
    [
        "",
        "Python, Django, SQL",
        "Node.js, Next.js, TypeScript, MongoDB, Docker, AWS, Git, React, Redux, PostgreSQL",
        "Hola, soy Ana",
        "1234 5678 9012 3456 7890 1234 5678 9012",
    ],
)
def test_returns_none_when_the_text_gives_no_clear_answer(text: str) -> None:
    assert detect_language(text) is None


def test_accents_and_case_do_not_matter() -> None:
    assert detect_language(SPANISH.upper()) == "Español"
    assert detect_language("TRABAJÉ " + SPANISH_CV_STYLE.lower()) == "Español"


@pytest.fixture
def client_factory():
    def make(provider: FakeProvider) -> tuple[TestClient, FakeRepository]:
        repository = FakeRepository()
        app.dependency_overrides[require_user_id] = lambda: "user-1"
        app.dependency_overrides[get_generation_service] = lambda: CvGenerationService(
            provider=provider, repository=repository
        )
        return TestClient(app), repository

    yield make
    app.dependency_overrides.clear()


def generate(client: TestClient, text: str, key: str = "00000000-0000-0000-0000-000000000401"):
    return client.post(
        "/api/generate-cv",
        headers={"Authorization": "Bearer token", "Idempotency-Key": key},
        json={"text": text},
    )


def test_a_text_without_languages_gets_the_language_it_is_written_in(client_factory) -> None:
    client, repository = client_factory(FakeProvider())

    response = generate(client, SPANISH)

    assert response.status_code == 200
    assert response.json()["languages"] == [{"name": "Español", "proficiency": ""}]
    # What is stored is what is shown.
    assert repository.rows[("user-1", "00000000-0000-0000-0000-000000000401")]["data"]["languages"] == [
        {"name": "Español", "proficiency": ""}
    ]


def test_an_english_text_gets_english(client_factory) -> None:
    client, _ = client_factory(FakeProvider())

    assert generate(client, ENGLISH).json()["languages"] == [{"name": "Inglés", "proficiency": ""}]


def test_languages_found_by_the_ai_are_never_replaced(client_factory) -> None:
    cv = copy.deepcopy(VALID_CV)
    cv["languages"] = [{"name": "Inglés", "proficiency": "Avanzado"}]
    client, _ = client_factory(FakeProvider(response=cv))

    response = generate(client, SPANISH)

    assert response.json()["languages"] == [{"name": "Inglés", "proficiency": "Avanzado"}]


def test_an_unclear_text_leaves_the_section_empty(client_factory) -> None:
    client, _ = client_factory(FakeProvider())

    assert generate(client, "Python, Django, SQL").json()["languages"] == []


def test_repeating_the_request_does_not_add_the_language_twice(client_factory) -> None:
    provider = FakeProvider()
    client, _ = client_factory(provider)

    first = generate(client, SPANISH)
    second = generate(client, SPANISH)

    assert first.json()["languages"] == second.json()["languages"] == [{"name": "Español", "proficiency": ""}]
    assert provider.calls == 1
