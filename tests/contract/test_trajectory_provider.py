import json

import httpx
import pytest

from app.core.settings import Settings
from app.models.trajectory_assistance import AssistanceTurnRequest
from app.services.azure_openai import AzureOpenAIError, AzureOpenAIProvider


def make_settings() -> Settings:
    return Settings(
        supabase_url="https://supabase.example.test",
        supabase_anon_key="public-test-key",
        supabase_service_role_key="server-test-key",
        supabase_db_url="postgresql://db.example.test/test",
        azure_openai_endpoint="https://azure.example.test",
        azure_openai_api_key="azure-test-key",
        azure_openai_api_version="2024-10-21",
        azure_openai_deployment="test-deployment",
    )


@pytest.mark.asyncio
async def test_assistance_provider_sends_strict_json_prompt_to_backend_endpoint() -> None:
    response_body = {
        "state": "needs_input",
        "questions": [{"id": "q1", "text": "¿Qué alcance tuvo el cambio?"}],
    }
    captured: dict[str, httpx.Request] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["request"] = request
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(response_body)}}]},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        provider = AzureOpenAIProvider(settings=make_settings(), client=client)
        result = await provider.generate_assistance_turn(
            AssistanceTurnRequest.model_validate(
                {"sourceText": "Coordiné una migración.", "answers": []}
            )
        )

    request = captured["request"]
    payload = json.loads(request.content)
    assert request.url.scheme == "https"
    assert request.url.host == "azure.example.test"
    assert request.url.path.endswith("/chat/completions")
    assert payload["response_format"] == {"type": "json_object"}
    assert payload["temperature"] == 0
    assert "Never invent" in payload["messages"][0]["content"]
    assert json.loads(payload["messages"][1]["content"])["sourceText"] == "Coordiné una migración."
    assert result == response_body


@pytest.mark.asyncio
async def test_assistance_provider_maps_upstream_errors_without_leaking_details() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": {"message": "PRIVATE_PROVIDER_DETAIL"}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        provider = AzureOpenAIProvider(settings=make_settings(), client=client)
        with pytest.raises(AzureOpenAIError) as error:
            await provider.generate_assistance_turn(
                AssistanceTurnRequest.model_validate({"sourceText": "Trayectoria real.", "answers": []})
            )

    assert "PRIVATE_PROVIDER_DETAIL" not in str(error.value)