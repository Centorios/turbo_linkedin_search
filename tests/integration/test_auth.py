from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core.auth import require_user_id


class FakeAuth:
    def __init__(self, token: str) -> None:
        self.token = token

    def get_user(self, token: str) -> SimpleNamespace:
        if token != self.token:
            raise RuntimeError("token rejected")
        return SimpleNamespace(user=SimpleNamespace(id="00000000-0000-0000-0000-000000000001"))


class FakeClient:
    def __init__(self, valid_token: str) -> None:
        self.auth = FakeAuth(valid_token)


@pytest.mark.asyncio
async def test_missing_bearer_token_is_rejected() -> None:
    with pytest.raises(HTTPException) as error:
        await require_user_id(None, FakeClient("valid"))

    assert error.value.status_code == 401


@pytest.mark.asyncio
async def test_invalid_bearer_token_is_rejected() -> None:
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid")

    with pytest.raises(HTTPException) as error:
        await require_user_id(credentials, FakeClient("valid"))

    assert error.value.status_code == 401


@pytest.mark.asyncio
async def test_expired_bearer_token_is_rejected() -> None:
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="expired")

    with pytest.raises(HTTPException) as error:
        await require_user_id(credentials, FakeClient("valid"))

    assert error.value.status_code == 401


@pytest.mark.asyncio
async def test_valid_bearer_token_returns_authenticated_user_id() -> None:
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid")

    user_id = await require_user_id(credentials, FakeClient("valid"))

    assert user_id == "00000000-0000-0000-0000-000000000001"