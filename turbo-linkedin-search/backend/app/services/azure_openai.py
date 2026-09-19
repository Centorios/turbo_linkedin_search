import json
from typing import Any
from urllib.parse import quote

import httpx

from app.core.settings import Settings, get_settings


SYSTEM_PROMPT = """You extract professional information into the exact CV JSON contract.
Return only one valid JSON object with exactly this shape and these exact property names:
{
    "personalInfo": {"fullName": "", "email": "", "phone": "", "location": "", "linkedin": "", "website": ""},
    "summary": "",
    "experience": [{"title": "", "company": "", "location": "", "startDate": "", "endDate": "", "achievements": []}],
    "education": [{"institution": "", "program": "", "startDate": "", "endDate": "", "description": ""}],
    "skills": {"hard": [], "soft": []},
    "languages": [{"name": "", "proficiency": ""}],
    "certifications": [{"name": "", "issuer": "", "issueDate": "", "expirationDate": "", "credential": ""}]
}
Do not use aliases such as name, address, profile, jobs, studies, technicalSkills, or softSkills.
Use empty strings for unavailable scalar values and empty arrays for unavailable collections.
Never invent names, dates, employers, education, skills, achievements, languages or credentials.
Dates must be empty, YYYY, or MM-YYYY. email must be empty or valid. linkedin and website
must be empty or valid http/https URLs. Every required property must be present.
Write achievement bullets only from facts in the source text and preserve quantitative facts.
Do not include markdown fences, commentary, or additional keys."""


class AzureOpenAIError(Exception):
    """A provider failure that is safe to expose as a generic upstream error."""


class AzureOpenAIProvider:
    def __init__(self, settings: Settings | None = None, client: httpx.AsyncClient | None = None) -> None:
        self.settings = settings or get_settings()
        self.client = client

    async def generate_cv(self, text: str) -> dict[str, Any]:
        endpoint = self.settings.azure_openai_endpoint.rstrip("/")
        deployment = quote(self.settings.azure_openai_deployment, safe="")
        url = (
            f"{endpoint}/openai/deployments/{deployment}/chat/completions"
            f"?api-version={quote(self.settings.azure_openai_api_version, safe='')}"
        )
        payload = {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            "temperature": 0,
            "response_format": {"type": "json_object"},
        }

        try:
            if self.client is None:
                async with httpx.AsyncClient(timeout=60) as client:
                    response = await client.post(url, headers=self._headers(), json=payload)
            else:
                response = await self.client.post(url, headers=self._headers(), json=payload)
            response.raise_for_status()
            response_payload = response.json()
            content = response_payload["choices"][0]["message"]["content"]
            data = json.loads(content)
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise AzureOpenAIError("Azure OpenAI request failed") from exc

        if not isinstance(data, dict):
            raise AzureOpenAIError("Azure OpenAI returned a non-object JSON value")
        return data

    def _headers(self) -> dict[str, str]:
        return {
            "api-key": self.settings.azure_openai_api_key,
            "Content-Type": "application/json",
        }