import pytest


@pytest.fixture
def valid_access_token() -> str:
    return "test-valid-access-token"


@pytest.fixture
def expired_access_token() -> str:
    return "test-expired-access-token"


@pytest.fixture
def another_user_id() -> str:
    return "00000000-0000-0000-0000-000000000002"


@pytest.fixture
def apify_items():
    long_text = "Descripción completa del puesto. " * 20
    return [
        {"id": "111", "title": "Backend Developer", "jobUrl": "https://www.linkedin.com/jobs/view/111",
         "descriptionText": long_text, "companyName": "Acme", "location": "Buenos Aires"},
        {"id": "222", "title": "Data Engineer", "jobUrl": "https://www.linkedin.com/jobs/view/222",
         "descriptionText": "Corta", "companyName": "Beta", "location": "Remoto"},
        {"id": "333", "title": "Sin URL", "companyName": "Gamma", "location": "X"},
    ]
