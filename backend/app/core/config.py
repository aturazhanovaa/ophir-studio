from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List

class Settings(BaseSettings):
    app_name: str = Field(default="Studio Knowledge Hub", alias="APP_NAME")
    app_env: str = Field(default="local", alias="APP_ENV")
    data_dir: str = Field(default="app_data", alias="DATA_DIR")

    # Database
    # - Leave empty for local SQLite (DATA_DIR/app.db)
    # - Set to a Postgres URL for Supabase, e.g.:
    #   postgresql+psycopg2://USER:PASSWORD@HOST:5432/postgres?sslmode=require
    database_url: str = Field(default="", alias="DATABASE_URL")

    jwt_secret: str = Field(default="change-me", alias="JWT_SECRET")
    jwt_expire_minutes: int = Field(default=60 * 24 * 7, alias="JWT_EXPIRE_MINUTES")

    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_chat_model: str = Field(default="gpt-4o-mini", alias="OPENAI_CHAT_MODEL")
    openai_embed_model: str = Field(default="text-embedding-3-small", alias="OPENAI_EMBED_MODEL")
    embedding_dim: int = Field(default=1536, alias="EMBEDDING_DIM")

    integration_key: str = Field(default="change-me", alias="INTEGRATION_KEY")
    notion_api_key: str = Field(default="", alias="NOTION_API_KEY")
    notion_api_version: str = Field(default="2022-06-28", alias="NOTION_API_VERSION")
    notion_api_base: str = Field(default="https://api.notion.com/v1", alias="NOTION_API_BASE")

    # Storage (Render has ephemeral disk; use Supabase Storage in prod)
    storage_provider: str = Field(default="local", alias="STORAGE_PROVIDER")  # local|supabase
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(default="", alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_storage_bucket: str = Field(default="legal-examples", alias="SUPABASE_STORAGE_BUCKET")

    cors_origins: str = Field(default="http://localhost:5173,http://127.0.0.1:5173", alias="CORS_ORIGINS")

    def cors_list(self) -> List[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

    def is_postgres(self) -> bool:
        return (self.database_url or "").startswith("postgres")

    class Config:
        env_file = ".env"

settings = Settings()
