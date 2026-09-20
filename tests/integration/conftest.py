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
