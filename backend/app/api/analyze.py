"""Analise multimodal: upload de arquivo ou link -> Claude Vision."""
import os
import tempfile
import uuid
import yt_dlp
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from ..api.deps import require_pro
from ..models import User
from ..services.analyzer import analyze_media
from ..services.downloader import detect_platform

router = APIRouter(prefix="/analyze", tags=["analyze"])

ALLOWED = {".jpg", ".jpeg", ".png", ".webp", ".gif",
           ".mp4", ".mov", ".webm", ".mkv", ".avi"}
MAX_BYTES = 50 * 1024 * 1024  # 50 MB


def _tmpdir():
    d = os.path.join(tempfile.gettempdir(), "analyze", uuid.uuid4().hex)
    os.makedirs(d, exist_ok=True)
    return d


@router.post("/upload")
async def analyze_upload(
    file: UploadFile = File(...),
    user: User = Depends(require_pro),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED:
        raise HTTPException(415, f"Formato nao suportado: {ext}")
    tmpdir = _tmpdir()
    path = os.path.join(tmpdir, f"media{ext}")
    size = 0
    with open(path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_BYTES:
                raise HTTPException(413, "Arquivo muito grande (limite 50 MB)")
            f.write(chunk)
    try:
        result = analyze_media(path)
    except Exception as e:
        raise HTTPException(422, str(e))
    finally:
        try:
            os.remove(path)
        except Exception:
            pass
    return {"result": result}


class LinkBody(BaseModel):
    url: str


@router.post("/link")
def analyze_link(body: LinkBody, user: User = Depends(require_pro)):
    if not detect_platform(body.url):
        raise HTTPException(422, "Link nao reconhecido. Use YouTube, Instagram, TikTok, Facebook ou Pinterest.")
    tmpdir = _tmpdir()
    opts = {
        "outtmpl": os.path.join(tmpdir, "%(id)s.%(ext)s"),
        "quiet": True,
        "format": "best[height<=720]/best",  # limita resolucao para velocidade
        "noplaylist": True,
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(body.url, download=True)
            path = ydl.prepare_filename(info)
            if not os.path.exists(path):
                # tenta encontrar o arquivo baixado
                files = [os.path.join(tmpdir, f) for f in os.listdir(tmpdir)]
                if not files:
                    raise HTTPException(422, "Nao foi possivel baixar o conteudo.")
                path = files[0]
    except yt_dlp.utils.DownloadError as e:
        raise HTTPException(422, f"Erro ao baixar: {str(e)[:200]}")
    try:
        result = analyze_media(path)
    except Exception as e:
        raise HTTPException(422, str(e))
    finally:
        try:
            os.remove(path)
        except Exception:
            pass
    return {"result": result}
