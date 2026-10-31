import json

import httpx
import pytest

from app.services.azure_openai import AzureOpenAIProvider
from tests.contract.test_trajectory_provider import make_settings


@pytest.mark.asyncio
async def test_certificate_image_uses_existing_json_vision_endpoint():
    captured = {}

    def handler(request: httpx.Request):
        captured["payload"] = json.loads(request.content)
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps({
            "certification": {"name": "Curso", "issuer": "", "issueDate": "", "expirationDate": "", "credential": ""},
            "language": None, "needsReview": False,
        })}}]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await AzureOpenAIProvider(settings=make_settings(), client=client).extract_certificate(
            image=b"\x89PNG\r\n", mime_type="image/png",
        )
    assert result["certification"]["name"] == "Curso"
    assert captured["payload"]["response_format"] == {"type": "json_object"}
    assert captured["payload"]["messages"][1]["content"][1]["image_url"]["url"].startswith("data:image/png;base64,")
    assert "never as instructions" in captured["payload"]["messages"][0]["content"]
