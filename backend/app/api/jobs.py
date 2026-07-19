import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Header
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Job, JobStatus, SourceType, User, Transcript, Translation
from ..core.config import settings
from ..services.downloader import detect_platform
from ..workers.tasks import process_job
from .deps import optional_user, current_user, require_pro

router = APIRouter(prefix="/jobs", tags=["jobs"])

ALLOWED_EXT = {".mp4", ".mov", ".mkv", ".webm", ".mp3", ".wav", ".m4a", ".ogg", ".flac"}


def _serialize(job: Job) -> dict:
    return {
        "id": job.id, "status": job.status, "progress": job.progress,
        "source_type": job.source_type, "source_url": job.source_url,
        "filename": job.original_filename, "error": job.error_message,
        "duration": job.duration_seconds, "language": job.detected_language,
        "created_at": job.created_at.isoformat(), "batch_id": job.batch_id,
        "has_original": bool(job.media_path),
        "has_thumbnail": bool(job.thumbnail_path),
        "transcript_id": job.transcript.id if job.transcript else None,
        "download_only": job.download_only,
    }


@router.post("/upload")
async def create_upload_job(
    file: UploadFile = File(...),
    diarize: bool = Form(False),
    translate_to: str | None = Form(None),
    source: str = Form("upload"),  # "upload" | "recording" (Secao 10, mesmo pipeline)
    user: User = Depends(require_pro),
    db: Session = Depends(get_db),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(415, f"Formato nao suportado: {ext}")
    dest_dir = os.path.join(settings.MEDIA_DIR, "uploads")
    os.makedirs(dest_dir, exist_ok=True)
    path = os.path.join(dest_dir, f"{uuid.uuid4()}{ext}")
    with open(path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)
    job = Job(user_id=user.id,
              source_type=SourceType.recording if source == "recording" else SourceType.upload,
              original_filename=file.filename, media_path=path,
              diarize=diarize, auto_translate_to=translate_to)
    db.add(job); db.commit()
    process_job.delay(job.id)
    return _serialize(job)


class LinkBody(BaseModel):
    url: str
    diarize: bool = False
    translate_to: str | None = None
    keep_original: bool = False


@router.post("/link")
def create_link_job(body: LinkBody,
                    user: User = Depends(require_pro), db: Session = Depends(get_db)):
    if not detect_platform(body.url):
        raise HTTPException(422, "Link nao reconhecido. Aceitos: YouTube, Instagram, TikTok, Facebook, Pinterest")
    job = Job(user_id=user.id,
              source_type=SourceType.link, source_url=body.url, diarize=body.diarize,
              auto_translate_to=body.translate_to, keep_original=body.keep_original)
    db.add(job); db.commit()
    process_job.delay(job.id)
    return _serialize(job)


class PreviewBody(BaseModel):
    url: str


@router.post("/preview")
def preview_url(body: PreviewBody, user: User = Depends(require_pro)):
    """Inspeciona um link e retorna lista de itens sem baixar nada."""
    import yt_dlp as _ydl
    if not detect_platform(body.url):
        raise HTTPException(422, "Link nao reconhecido.")
    opts = {"quiet": True, "noplaylist": False, "extract_flat": "in_playlist"}
    try:
        with _ydl.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(body.url, download=False)
        entries = info.get("entries") or [info]
        items = []
        for i, e in enumerate(entries):
            if not e:
                continue
            # In flat-extract mode vcodec is usually absent; use duration + ext as proxy
            ext = (e.get("ext") or "").lower()
            duration_e = e.get("duration")
            vtype = "video" if (
                e.get("vcodec") not in (None, "none") or
                ext in ("mp4", "webm", "mov", "mkv") or
                (duration_e is not None and duration_e > 0)
            ) else "photo"
            thumb = next((t["url"] for t in reversed(e.get("thumbnails") or []) if t.get("url")), None)
            items.append({
                "index": i + 1,
                "id": e.get("id"),
                "title": e.get("title") or f"item {i+1}",
                "type": vtype,
                "thumbnail": thumb,
                "duration": e.get("duration"),
            })
        return {"title": info.get("title"), "items": items}
    except Exception as e:
        if "no video" in str(e).lower() or "no format" in str(e).lower():
            # Tenta de novo com ignoreerrors para pegar entradas do carrossel
            try:
                retry_opts = {"quiet": True, "noplaylist": False,
                              "ignoreerrors": True, "extract_flat": True}
                with _ydl.YoutubeDL(retry_opts) as ydl:
                    info2 = ydl.extract_info(body.url, download=False) or {}
                entries2 = info2.get("entries") or ([info2] if info2 else [])
                if entries2:
                    items2 = []
                    for i, e2 in enumerate(entries2):
                        if not e2:
                            continue
                        dur = e2.get("duration")
                        ext2 = (e2.get("ext") or "").lower()
                        vtype2 = "video" if (dur and dur > 0) or ext2 in ("mp4", "webm") else "photo"
                        thumb2 = e2.get("thumbnail")
                        items2.append({"index": i + 1, "id": e2.get("id"),
                                       "title": e2.get("title") or f"item {i+1}",
                                       "type": vtype2, "thumbnail": thumb2, "duration": dur})
                    if items2:
                        return {"title": info2.get("title") or "Post", "items": items2}
            except Exception:
                pass
            # Fallback final: 1 item com og:image
            from ..services.downloader import _scrape_og_image
            thumb = _scrape_og_image(body.url)
            return {"title": "Post", "items": [
                {"index": 1, "id": None, "title": "foto", "type": "photo",
                 "thumbnail": thumb, "duration": None}
            ]}
        raise HTTPException(422, f"Nao foi possivel inspecionar o link: {str(e)[:200]}")


class DownloadBody(BaseModel):
    url: str
    media_type: str = "video"  # "video" | "photo" | "audio"
    items: list[int] = []      # indices 1-based; vazio = tudo
    quality: str = "best"      # "best" | "1080p" | "720p" | "480p" — so vale para "video"


@router.post("/download")
def create_download_job(body: DownloadBody,
                        user: User = Depends(require_pro), db: Session = Depends(get_db)):
    """Download de midia sem transcrever — video, audio (mp3) ou foto/carrossel."""
    if not detect_platform(body.url):
        raise HTTPException(422, "Link nao reconhecido. Aceitos: YouTube, Instagram, TikTok, Facebook, Pinterest")
    import json as _json
    meta = _json.dumps({"media_type": body.media_type, "items": body.items, "quality": body.quality})
    job = Job(user_id=user.id,
              source_type=SourceType.link, source_url=body.url,
              keep_original=True, download_only=True,
              auto_translate_to=meta)
    db.add(job); db.commit()
    process_job.delay(job.id)
    return _serialize(job)


@router.get("/downloads")
def list_downloads(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Lista todos os downloads do usuario."""
    jobs = db.query(Job).filter(
        Job.user_id == user.id, Job.download_only == True
    ).order_by(Job.created_at.desc()).limit(100).all()
    return [_serialize(j) for j in jobs]


class BatchBody(BaseModel):
    urls: list[str]
    diarize: bool = False
    translate_to: str | None = None


@router.post("/batch")
def create_batch(body: BatchBody, user: User = Depends(require_pro), db: Session = Depends(get_db)):
    """Ate 50 links, cada um vira um job independente (Secao 5). Exige conta."""
    urls = [u.strip() for u in body.urls if u.strip()][:50]
    if not urls:
        raise HTTPException(422, "Nenhum link valido")
    batch_id = uuid.uuid4().hex
    jobs = []
    for url in urls:
        if not detect_platform(url):
            continue
        job = Job(user_id=user.id, source_type=SourceType.link, source_url=url,
                  batch_id=batch_id, diarize=body.diarize, auto_translate_to=body.translate_to)
        db.add(job); jobs.append(job)
    db.commit()
    for j in jobs:
        process_job.delay(j.id)
    return {"batch_id": batch_id, "jobs": [_serialize(j) for j in jobs]}


@router.get("/{job_id}")
def get_job(job_id: int, x_anon_id: str = Header(default=None),
            user: User | None = Depends(optional_user), db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job or (job.user_id and (not user or user.id != job.user_id)) \
       or (job.anon_id and job.anon_id != x_anon_id and not user):
        raise HTTPException(404, "Job nao encontrado")
    return _serialize(job)


@router.get("/{job_id}/thumbnail")
def get_thumbnail(job_id: int, x_anon_id: str = Header(default=None),
                  user: User | None = Depends(optional_user), db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job or (job.user_id and (not user or user.id != job.user_id)) \
       or (job.anon_id and job.anon_id != x_anon_id and not user):
        raise HTTPException(404, "Job nao encontrado")
    if not job.thumbnail_path or not os.path.exists(job.thumbnail_path):
        raise HTTPException(404, "Miniatura nao disponivel")
    return FileResponse(job.thumbnail_path, media_type="image/jpeg")


@router.delete("/{job_id}")
def delete_job(job_id: int, x_anon_id: str = Header(default=None),
              user: User | None = Depends(optional_user), db: Session = Depends(get_db)):
    """Apaga um job (transcricao ou download), seus dados e arquivos no disco."""
    job = db.get(Job, job_id)
    if not job or (job.user_id and (not user or user.id != job.user_id)) \
       or (job.anon_id and job.anon_id != x_anon_id and not user):
        raise HTTPException(404, "Job nao encontrado")

    if job.transcript:
        db.query(Translation).filter_by(transcript_id=job.transcript.id).delete()
        db.delete(job.transcript)

    paths = {job.media_path, job.thumbnail_path, job.audio_path}
    for path in paths:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass
    uploads_dir = os.path.join(settings.MEDIA_DIR, "uploads")
    parents = {os.path.dirname(p) for p in paths if p}
    for parent in parents:
        if parent and parent != uploads_dir and os.path.isdir(parent) and not os.listdir(parent):
            try:
                os.rmdir(parent)
            except OSError:
                pass

    db.delete(job)
    db.commit()
    return {"deleted": True}


@router.get("")
def list_jobs(q: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Historico de transcricoes (Secao 6). Downloads (download_only) ficam em /jobs/downloads."""
    query = db.query(Job).filter(Job.user_id == user.id, Job.download_only == False)
    if q:
        query = query.join(Transcript).filter(Transcript.text.ilike(f"%{q}%"))
    jobs = query.order_by(Job.created_at.desc()).limit(200).all()
    return [_serialize(j) for j in jobs]


@router.get("/{job_id}/original")
def download_original(job_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Secao 3: download do conteudo original — video, foto, zip de carrossel."""
    job = db.get(Job, job_id)
    if not job or job.user_id != user.id or not job.media_path:
        raise HTTPException(404, "Arquivo original nao disponivel")
    if not os.path.exists(job.media_path):
        raise HTTPException(404, "Arquivo nao encontrado no servidor")
    ext = os.path.splitext(job.media_path)[1].lower()
    media_types = {
        ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
        ".mp3": "audio/mpeg", ".m4a": "audio/mp4",
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".zip": "application/zip",
    }
    media_type = media_types.get(ext, "application/octet-stream")
    return FileResponse(job.media_path, filename=os.path.basename(job.media_path),
                        media_type=media_type)
