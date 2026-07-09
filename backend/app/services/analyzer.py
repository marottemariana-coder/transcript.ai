"""Analise multimodal de midia com Claude Vision — o que mostra, representa e sente."""
import base64
import glob
import os
import subprocess
import tempfile
import httpx
from pathlib import Path
from ..core.config import settings

IMAGE_MEDIA_TYPES = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
}
VIDEO_EXTS = {".mp4", ".mov", ".webm", ".mkv", ".avi"}


def _encode(path: str) -> dict:
    ext = Path(path).suffix.lower()
    mt = IMAGE_MEDIA_TYPES.get(ext, "image/jpeg")
    with open(path, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode()
    return {"type": "image", "source": {"type": "base64", "media_type": mt, "data": data}}


def _extract_frames(video_path: str, n: int = 5) -> list[str]:
    """Extrai n frames representativos do video via ffmpeg."""
    tmpdir = tempfile.mkdtemp()
    # Pega duracao
    r = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", video_path],
        capture_output=True, text=True, timeout=30,
    )
    try:
        duration = float(r.stdout.strip())
    except ValueError:
        duration = 60.0
    interval = max(1, duration / (n + 1))
    times = [interval * (i + 1) for i in range(n)]
    frames = []
    for i, t in enumerate(times):
        out = os.path.join(tmpdir, f"frame_{i:02d}.jpg")
        subprocess.run(
            ["ffmpeg", "-y", "-ss", str(t), "-i", video_path,
             "-vframes", "1", "-vf", "scale=1280:-1", "-q:v", "3", out],
            capture_output=True, timeout=30,
        )
        if os.path.exists(out):
            frames.append(out)
    return frames


def _ask_claude(content: list) -> str:
    prompt = (
        "Analise este conteudo visual com profundidade e responda em portugues usando exatamente este formato:\n\n"
        "**O QUE MOSTRA**\n"
        "Descreva de forma objetiva e detalhada o que aparece na imagem/video: pessoas, cenario, objetos, acoes, texto visivel, cores predominantes.\n\n"
        "**O QUE REPRESENTA**\n"
        "Interprete o significado mais profundo: mensagem, narrativa, simbolismo, contexto cultural, intenção comunicativa.\n\n"
        "**SENTIMENTO & ENERGIA**\n"
        "Descreva a emocao transmitida, o tom (alegre, nostalgico, urgente, inspirador...) e a energia geral do conteudo.\n\n"
        "**PARA QUE SERVE**\n"
        "Em uma linha: qual e o objetivo deste conteudo (informar, entreter, vender, inspirar, emocionar...)?"
    )
    content_with_prompt = content + [{"type": "text", "text": prompt}]
    r = httpx.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": settings.ANTHROPIC_API_KEY,
                 "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        json={"model": "claude-sonnet-4-6", "max_tokens": 2000,
              "messages": [{"role": "user", "content": content_with_prompt}]},
        timeout=120,
    )
    r.raise_for_status()
    return r.json()["content"][0]["text"]


def analyze_media(path: str) -> str:
    ext = Path(path).suffix.lower()
    if ext in VIDEO_EXTS:
        frames = _extract_frames(path, n=5)
        if not frames:
            raise ValueError("Nao foi possivel extrair frames do video.")
        content = [_encode(f) for f in frames]
        content.insert(0, {"type": "text",
                           "text": f"Este e um video com {len(frames)} frames extraidos em sequencia temporal."})
    elif ext in IMAGE_MEDIA_TYPES:
        content = [_encode(path)]
    else:
        raise ValueError(f"Formato nao suportado para analise: {ext}")
    return _ask_claude(content)
