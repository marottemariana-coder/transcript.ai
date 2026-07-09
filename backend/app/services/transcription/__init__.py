"""Camada modular de transcricao: trocar de provider = trocar 1 variavel de ambiente."""
from ...core.config import settings


def get_provider(diarize: bool = False):
    from .whisper_provider import WhisperProvider
    from .assemblyai_provider import AssemblyAIProvider
    name = settings.TRANSCRIPTION_PROVIDER
    # Diarizacao e timestamp por palavra exigem AssemblyAI (Whisper API nao faz)
    if diarize and settings.ASSEMBLYAI_API_KEY:
        return AssemblyAIProvider()
    if name == "assemblyai":
        return AssemblyAIProvider()
    return WhisperProvider()
