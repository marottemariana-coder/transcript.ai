from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://transcript:transcript@localhost:5432/transcript"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "dev-secret"
    MEDIA_DIR: str = "/data/media"
    TRANSCRIPTION_PROVIDER: str = "whisper"
    OPENAI_API_KEY: str = ""
    ASSEMBLYAI_API_KEY: str = ""
    TRANSLATION_PROVIDER: str = "deepl"
    DEEPL_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    FREE_PLAN_MINUTES: int = 120
    ANON_MAX_MINUTES: int = 15
    ENABLE_ORIGINAL_DOWNLOAD: bool = True
    YTDLP_COOKIES_FILE: str = ""
    INSTAGRAM_SESSION_ID: str = ""
    class Config:
        env_file = ".env"

settings = Settings()
