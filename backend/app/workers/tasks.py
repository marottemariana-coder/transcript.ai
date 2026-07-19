"""Pipeline assincrono: download -> extracao -> transcricao -> (traducao) -> pronto."""
import os
import shutil
import uuid
from .celery_app import celery
from ..db import SessionLocal
from ..models import Job, JobStatus, Transcript, Translation, SourceType, SpeakerProfile
from ..core.config import settings
from ..services import audio as audio_svc
from ..services.downloader import download_media, make_thumbnail, DownloadError
from ..services.transcription import get_provider
from ..services.translation import translate_segments
from ..services import voice_library


def _set(db, job: Job, status: JobStatus, progress: int):
    job.status, job.progress = status, progress
    db.commit()


@celery.task
def process_job(job_id: int):
    db = SessionLocal()
    job = db.get(Job, job_id)
    if not job:
        return
    workdir = os.path.join(settings.MEDIA_DIR, str(uuid.uuid4()))
    os.makedirs(workdir, exist_ok=True)
    remove_src_after_audio = False
    try:
        # 1. Obter midia
        if job.source_type == SourceType.link:
            _set(db, job, JobStatus.downloading, 10)
            keep = job.keep_original and settings.ENABLE_ORIGINAL_DOWNLOAD
            remove_src_after_audio = not keep
            media_type, selected_items = "video", []
            if job.download_only and job.auto_translate_to:
                try:
                    import json as _json
                    meta = _json.loads(job.auto_translate_to)
                    media_type = meta.get("media_type", "video")
                    selected_items = meta.get("items", [])
                except Exception:
                    media_type = job.auto_translate_to or "video"
            info = download_media(job.source_url, workdir, audio_only=not keep,
                                  media_type=media_type, selected_items=selected_items)
            job.media_path = info["path"] if keep else None
            if job.download_only:
                job.auto_translate_to = None
                if job.media_path:
                    job.thumbnail_path = make_thumbnail(job.media_path, workdir)
                elif os.path.exists(info["path"]):
                    # download descartavel (nao mantido): nada mais vai referencia-lo
                    os.remove(info["path"])
            src = info["path"]
            job.original_filename = info.get("title")
        else:
            src = job.media_path

        # 2. Se for apenas download, encerra aqui
        if job.download_only:
            _set(db, job, JobStatus.done, 100)
            return

        # 2. Extrair audio
        _set(db, job, JobStatus.extracting, 30)
        audio_path = os.path.join(workdir, "audio.mp3")
        audio_svc.extract_audio(src, audio_path)
        if remove_src_after_audio and os.path.exists(src):
            # video original ja nao e mais necessario apos extrair o audio
            os.remove(src)
        job.audio_path = audio_path
        job.duration_seconds = audio_svc.probe_duration(audio_path)
        db.commit()

        # 3. Transcrever
        _set(db, job, JobStatus.transcribing, 50)
        provider = get_provider(diarize=job.diarize)
        result = provider.transcribe(audio_path)
        job.detected_language = result.get("language")
        t = Transcript(job_id=job.id, text=result["text"],
                       segments=result["segments"], language=result.get("language"))
        db.add(t)
        db.commit()

        # 3b. Biblioteca de vozes: reconhecer locutores ja nomeados pelo usuario
        if job.diarize and job.user_id and voice_library.AVAILABLE:
            profiles = db.query(SpeakerProfile).filter_by(user_id=job.user_id).all()
            labels = {s.get("speaker") for s in t.segments if s.get("speaker")}
            renames = {}
            for label in labels:
                emb = voice_library.embed_speaker(audio_path, t.segments, label)
                match, _ = voice_library.match_profile(emb, profiles)
                if match:
                    renames[label] = match.name
            if renames:
                t.segments = [{**s, "speaker": renames.get(s.get("speaker"), s.get("speaker"))}
                              for s in t.segments]
                db.commit()

        # 4. Atalho "transcrever e traduzir" (Secao 4)
        if job.auto_translate_to:
            _set(db, job, JobStatus.translating, 85)
            tr = translate_segments(t.segments, t.text, job.auto_translate_to)
            db.add(Translation(transcript_id=t.id, target_language=job.auto_translate_to,
                               text=tr["text"], segments=tr["segments"]))
            db.commit()

        _set(db, job, JobStatus.done, 100)
    except DownloadError as e:
        job.status, job.error_message = JobStatus.error, str(e)
        db.commit()
        shutil.rmtree(workdir, ignore_errors=True)
    except Exception as e:
        job.status, job.error_message = JobStatus.error, f"Erro no processamento: {e}"
        db.commit()
        shutil.rmtree(workdir, ignore_errors=True)
    finally:
        db.close()
