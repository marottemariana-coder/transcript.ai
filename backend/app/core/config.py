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
    # Conteudo bruto de um cookies.txt (formato Netscape), para setar via env var
    # em plataformas sem disco persistente (ex: Railway). Se preenchido e
    # YTDLP_COOKIES_FILE nao estiver setado, o conteudo e gravado em disco e
    # YTDLP_COOKIES_FILE passa a apontar para esse arquivo (ver abaixo).
    YTDLP_COOKIES_CONTENT: str = ""
    INSTAGRAM_SESSION_ID: str = ""
    class Config:
        env_file = ".env"

settings = Settings()

if settings.YTDLP_COOKIES_CONTENT and not settings.YTDLP_COOKIES_FILE:
    import os as _os
    _cookies_path = _os.path.join(_os.sep, "tmp", "yt_cookies.txt")
    with open(_cookies_path, "w") as _f:
        _f.write(settings.YTDLP_COOKIES_CONTENT.replace("\\n", "\n"))
    settings.YTDLP_COOKIES_FILE = _cookies_path
