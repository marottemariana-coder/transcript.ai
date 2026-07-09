"""Biblioteca de vozes persistente (Secao 7).
Gera um embedding de voz por locutor (ECAPA-TDNN via speechbrain) e compara por
similaridade de cosseno com os perfis salvos do usuario. Se speechbrain nao
estiver instalado, o sistema segue funcionando so com rotulos por arquivo."""
import subprocess
import tempfile

SIM_THRESHOLD = 0.72  # limiar empirico; ajuste com dados reais

try:
    import torch
    import torchaudio
    from speechbrain.inference.speaker import EncoderClassifier
    _encoder = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")
    AVAILABLE = True
except Exception:
    AVAILABLE = False


def _clip(audio_path: str, start: float, end: float) -> str:
    out = tempfile.mktemp(suffix=".wav")
    subprocess.run(["ffmpeg", "-y", "-i", audio_path, "-ss", str(start),
                    "-to", str(min(end, start + 20)), "-ar", "16000", "-ac", "1", out],
                   capture_output=True, check=True)
    return out


def embed_speaker(audio_path: str, segments: list, speaker_label: str) -> list | None:
    """Embedding medio dos trechos de um locutor."""
    if not AVAILABLE:
        return None
    spans = [(s["start"], s["end"]) for s in segments if s.get("speaker") == speaker_label][:5]
    if not spans:
        return None
    embs = []
    for start, end in spans:
        wav_path = _clip(audio_path, start, end)
        sig, _ = torchaudio.load(wav_path)
        embs.append(_encoder.encode_batch(sig).squeeze())
    return torch.stack(embs).mean(0).tolist()


def match_profile(embedding: list, profiles: list) -> tuple:
    """Retorna (perfil, similaridade) do melhor match acima do limiar, ou (None, 0)."""
    if not AVAILABLE or not embedding or not profiles:
        return None, 0.0
    import torch.nn.functional as F
    e = torch.tensor(embedding)
    best, best_sim = None, 0.0
    for p in profiles:
        sim = F.cosine_similarity(e, torch.tensor(p.embedding), dim=0).item()
        if sim > best_sim:
            best, best_sim = p, sim
    if best_sim >= SIM_THRESHOLD:
        return best, best_sim
    return None, best_sim
