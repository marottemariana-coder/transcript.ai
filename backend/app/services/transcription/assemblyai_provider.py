"""AssemblyAI: diarizacao nativa + timestamp por palavra (Secao 7). Sem limite de 25 MB."""
import time
import httpx
from ...core.config import settings

BASE = "https://api.assemblyai.com/v2"


class AssemblyAIProvider:
    name = "assemblyai"
    supports_diarization = True
    supports_word_timestamps = True

    def _headers(self):
        return {"authorization": settings.ASSEMBLYAI_API_KEY}

    def transcribe(self, audio_path: str) -> dict:
        with open(audio_path, "rb") as f:
            up = httpx.post(f"{BASE}/upload", headers=self._headers(), content=f.read(), timeout=600)
        up.raise_for_status()
        job = httpx.post(
            f"{BASE}/transcript",
            headers=self._headers(),
            json={
                "audio_url": up.json()["upload_url"],
                "speaker_labels": True,
                "language_detection": True,
            },
            timeout=60,
        ).json()
        while True:
            data = httpx.get(f"{BASE}/transcript/{job['id']}", headers=self._headers(), timeout=60).json()
            if data["status"] in ("completed", "error"):
                break
            time.sleep(3)
        if data["status"] == "error":
            raise RuntimeError(data.get("error", "Falha na transcricao"))
        segments = []
        for utt in data.get("utterances") or []:
            segments.append({
                "start": utt["start"] / 1000,
                "end": utt["end"] / 1000,
                "text": utt["text"],
                "speaker": f"Locutor {utt['speaker']}",
                "words": [
                    {"start": w["start"] / 1000, "end": w["end"] / 1000, "word": w["text"]}
                    for w in utt.get("words", [])
                ],
            })
        return {
            "text": data.get("text", ""),
            "segments": segments,
            "language": data.get("language_code"),
        }
