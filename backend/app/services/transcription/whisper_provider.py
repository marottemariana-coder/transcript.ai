"""OpenAI Whisper API. Limite de 25 MB por arquivo -> fatiamento automatico."""
import os
import tempfile
import httpx
from ...core.config import settings
from ..audio import split_if_needed, probe_duration


class WhisperProvider:
    name = "whisper"
    supports_diarization = False
    supports_word_timestamps = True  # verbose_json com timestamp_granularities

    def transcribe(self, audio_path: str) -> dict:
        chunks = split_if_needed(audio_path, tempfile.mkdtemp())
        segments, full_text, offset = [], [], 0.0
        language = None
        for chunk in chunks:
            data = self._call(chunk)
            language = language or data.get("language")
            for seg in data.get("segments", []):
                segments.append({
                    "start": seg["start"] + offset,
                    "end": seg["end"] + offset,
                    "text": seg["text"].strip(),
                    "speaker": None,
                    "words": [
                        {"start": w["start"] + offset, "end": w["end"] + offset, "word": w["word"]}
                        for w in data.get("words", [])
                        if seg["start"] <= w["start"] < seg["end"]
                    ],
                })
            full_text.append(data.get("text", ""))
            offset += probe_duration(chunk)
        return {"text": " ".join(full_text).strip(), "segments": segments, "language": language}

    def _call(self, path: str) -> dict:
        with open(path, "rb") as f:
            r = httpx.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                data={
                    "model": "whisper-1",
                    "response_format": "verbose_json",
                    "timestamp_granularities[]": "segment",
                },
                files={"file": (os.path.basename(path), f, "audio/mpeg")},
                timeout=600,
            )
        r.raise_for_status()
        return r.json()
