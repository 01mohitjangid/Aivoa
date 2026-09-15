import re

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    groq_api_key: str = ""
    database_url: str = "mysql+pymysql://root@localhost:3306/aivoa"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @field_validator("database_url")
    @classmethod
    def _use_psycopg(cls, url: str) -> str:
        return re.sub(r"^postgres(ql)?://", "postgresql+psycopg://", url)


settings = Settings()
