import datetime as dt
import enum
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Text, JSON, Boolean, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


class Plan(str, enum.Enum):
    free = "free"
    pro = "pro"          # estrutura pronta; cobrança não implementada


class JobStatus(str, enum.Enum):
    queued = "queued"
    downloading = "downloading"
    extracting = "extracting"
    transcribing = "transcribing"
    translating = "translating"
    done = "done"
    error = "error"


class SourceType(str, enum.Enum):
    upload = "upload"
    link = "link"
    recording = "recording"


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    plan: Mapped[Plan] = mapped_column(Enum(Plan), default=Plan.free)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow)
    jobs: Mapped[list["Job"]] = relationship(back_populates="user")
    speakers: Mapped[list["SpeakerProfile"]] = relationship(back_populates="user")

    def minutes_used_this_month(self, db) -> float:
        start = dt.datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        total = 0.0
        for j in self.jobs:
            if j.created_at >= start and j.duration_seconds:
                total += j.duration_seconds / 60.0
        return total


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    anon_id: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)  # uso sem conta (Seção 9)
    batch_id: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)  # lote (Seção 5)
    source_type: Mapped[SourceType] = mapped_column(Enum(SourceType))
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String(512), nullable=True)
    media_path: Mapped[str | None] = mapped_column(Text, nullable=True)      # original (Seção 3)
    thumbnail_path: Mapped[str | None] = mapped_column(Text, nullable=True)  # miniatura gerada do original
    audio_path: Mapped[str | None] = mapped_column(Text, nullable=True)      # áudio extraído
    keep_original: Mapped[bool] = mapped_column(Boolean, default=False)
    download_only: Mapped[bool] = mapped_column(Boolean, default=False)
    diarize: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_translate_to: Mapped[str | None] = mapped_column(Text, nullable=True)  # atalho "transcrever e traduzir" ou JSON de download
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.queued, index=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)  # 0–100
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    detected_language: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow, index=True)
    user: Mapped["User | None"] = relationship(back_populates="jobs")
    transcript: Mapped["Transcript | None"] = relationship(back_populates="job", uselist=False)


class Transcript(Base):
    __tablename__ = "transcripts"
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), unique=True)
    text: Mapped[str] = mapped_column(Text)  # texto completo (busca full-text — Seção 6)
    # segments: [{start, end, text, speaker, words: [{start, end, word}]}]
    segments: Mapped[list] = mapped_column(JSON, default=list)
    language: Mapped[str | None] = mapped_column(String(10), nullable=True)
    job: Mapped["Job"] = relationship(back_populates="transcript")
    translations: Mapped[list["Translation"]] = relationship(back_populates="transcript")


class Translation(Base):
    __tablename__ = "translations"
    id: Mapped[int] = mapped_column(primary_key=True)
    transcript_id: Mapped[int] = mapped_column(ForeignKey("transcripts.id"), index=True)
    target_language: Mapped[str] = mapped_column(String(10))
    text: Mapped[str] = mapped_column(Text)
    segments: Mapped[list] = mapped_column(JSON, default=list)  # mesmos timestamps do original
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow)
    transcript: Mapped["Transcript"] = relationship(back_populates="translations")


class SpeakerProfile(Base):
    """Biblioteca de vozes persistente (Seção 7)."""
    __tablename__ = "speaker_profiles"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    embedding: Mapped[list] = mapped_column(JSON)  # vetor de voz (ECAPA), comparado por cosseno
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow)
    user: Mapped["User"] = relationship(back_populates="speakers")
