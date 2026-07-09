"""Extração, compressão e fatiamento de áudio com ffmpeg."""
import json
import math
import os
import subprocess

MAX_WHISPER_BYTES = 25 * 1024 * 1024  # limite fixo da API da OpenAI


def probe_duration(path: str) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", path],
        capture_output=True, text=True, check=True,
    )
    return float(json.loads(out.stdout)["format"]["duration"])


def extract_audio(src: str, dst: str) -> str:
    """Converte qualquer video/audio para MP3 mono 48kbps (qualidade suficiente para STT)."""
    subprocess.run(
        ["ffmpeg", "-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000",
         "-b:a", "48k", dst],
        capture_output=True, check=True,
    )
    return dst


def split_if_needed(audio_path: str, workdir: str) -> list[str]:
    """Fatia o audio em blocos < 25 MB para a API do Whisper, com corte por tempo."""
    size = os.path.getsize(audio_path)
    if size <= MAX_WHISPER_BYTES:
        return [audio_path]
    duration = probe_duration(audio_path)
    n_chunks = math.ceil(size / (MAX_WHISPER_BYTES * 0.9))
    chunk_len = duration / n_chunks
    paths = []
    for i in range(n_chunks):
        p = os.path.join(workdir, f"chunk_{i:03d}.mp3")
        subprocess.run(
            ["ffmpeg", "-y", "-i", audio_path, "-ss", str(i * chunk_len),
             "-t", str(chunk_len), "-c", "copy", p],
            capture_output=True, check=True,
        )
        paths.append(p)
    return paths
