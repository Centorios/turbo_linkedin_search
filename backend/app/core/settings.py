from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        extra="ignore",
    )

    app_env: str = "development"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_db_url: str
    azure_openai_endpoint: str
    azure_openai_api_key: str
    azure_openai_api_version: str
    azure_openai_deployment: str
    azure_openai_embedding_deployment: str = "text-embedding-3-small"
    azure_openai_embedding_dimensions: int = 1536
    match_deadline_seconds: int = 75
    match_embeddings_timeout_seconds: int = 20
    match_llm_timeout_seconds: int = 45
    match_candidates_k: int = 8
    jooble_ar_api_key: str = ""
    apify_token: str = ""
    apify_linkedin_actor_id: str = ""
    apify_max_charge_usd: float = 0.10
    apify_run_timeout_seconds: int = 180
    apify_max_items: int = 20
    apify_webhook_secret: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
