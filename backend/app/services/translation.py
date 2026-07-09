"""Traducao como etapa separada da transcricao (Secao 4).
Whisper nativo so traduz para ingles; aqui traduzimos para qualquer idioma."""
import httpx
from ..core.config import settings


def translate_segments(segments: list, full_text: str, target_lang: str) -> dict:
    if settings.TRANSLATION_PROVIDER == "deepl" and settings.DEEPL_API_KEY:
        return _deepl(segments, target_lang)
    return _llm(segments, target_lang)


def _deepl(segments: list, target_lang: str) -> dict:
    texts = [s["text"] for s in segments]
    out_segments, translated_all = [], []
    # DeepL aceita ate 50 textos por request
    for i in range(0, len(texts), 50):
        batch = texts[i:i + 50]
        r = httpx.post(
            "https://api-free.deepl.com/v2/translate",
            headers={"Authorization": f"DeepL-Auth-Key {settings.DEEPL_API_KEY}"},
            data=[("text", t) for t in batch] + [("target_lang", target_lang.upper())],
            timeout=120,
        )
        r.raise_for_status()
        translated_all += [t["text"] for t in r.json()["translations"]]
    for seg, txt in zip(segments, translated_all):
        out_segments.append({**seg, "text": txt, "words": []})
    return {"text": " ".join(translated_all), "segments": out_segments}


def _llm(segments: list, target_lang: str) -> dict:
    """Fallback via Claude: traducao fiel preservando a divisao por segmentos."""
    numbered = "\n".join(f"[{i}] {s['text']}" for i, s in enumerate(segments))
    r = httpx.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": settings.ANTHROPIC_API_KEY,
                 "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        json={
            "model": "claude-sonnet-4-6",
            "max_tokens": 8000,
            "messages": [{"role": "user", "content":
                f"Traduza fielmente cada linha numerada abaixo para o idioma '{target_lang}'. "
                f"Mantenha a numeracao [i] identica, uma traducao por linha, sem comentarios.\n\n{numbered}"}],
        },
        timeout=300,
    )
    r.raise_for_status()
    text = r.json()["content"][0]["text"]
    mapping = {}
    for line in text.splitlines():
        if line.strip().startswith("["):
            idx, _, rest = line.partition("]")
            try:
                mapping[int(idx.strip("[ "))] = rest.strip()
            except ValueError:
                pass
    out_segments = [{**s, "text": mapping.get(i, s["text"]), "words": []} for i, s in enumerate(segments)]
    return {"text": " ".join(s["text"] for s in out_segments), "segments": out_segments}
