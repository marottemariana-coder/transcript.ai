# transcript.ai

Transcricao de audio e video por upload, link (YouTube, Instagram, TikTok, Facebook) ou gravacao direta, com traducao, diarizacao, biblioteca de vozes, recursos de IA e exportacao em 8 formatos.

## Rodar em desenvolvimento

1. Copie `.env.example` para `.env` e preencha ao menos `OPENAI_API_KEY` (ou `ASSEMBLYAI_API_KEY`) e `SECRET_KEY`.
2. `docker compose up --build`
3. Frontend: http://localhost:5173 · API: http://localhost:8000/docs

## Mapa spec -> codigo

| Secao | Onde |
|---|---|
| 1 Upload | `api/jobs.py::create_upload_job` + `workers/tasks.py` |
| 2 Link | `services/downloader.py` + `api/jobs.py::create_link_job` |
| 3 Download original | flag `keep_original` + `GET /jobs/{id}/original` (uso pessoal/interno) |
| 4 Traducao | `services/translation.py` (DeepL ou LLM), lado a lado no frontend, atalho `translate_to` |
| 5 Lote (50 links) | `POST /jobs/batch` + pagina `/batch` |
| 6 Busca no conteudo | `GET /jobs?q=` (ILIKE no texto) + destaque `?hl=` na tela |
| 7 Diarizacao + vozes | AssemblyAI (`diarize=true`) + `services/voice_library.py` (ECAPA opcional) |
| 8 IA | `services/ai_features.py`: resumo, citacoes, mapa mental, chat |
| 9 Sem conta | header `X-Anon-Id`, 1 transcricao gratis, login para historico/lote |
| 10 Gravacao | MediaRecorder no frontend, mesmo pipeline de upload |
| Exportacao | txt, docx, pdf, srt, vtt, json, html, fcpxml (Premiere importa o srt) |
| Cotas | `FREE_PLAN_MINUTES` por mes; campo `plan` pronto para pagos |

## Avisos tecnicos

- Whisper API: limite fixo de 25 MB -> `services/audio.py` comprime (mono 48k) e fatia automaticamente.
- Diarizacao e timestamp por palavra: exigem AssemblyAI (a Whisper API nao diariza). Com `diarize=true` e chave configurada, a troca e automatica.
- Biblioteca de vozes: reconhecimento entre arquivos usa embeddings ECAPA (speechbrain). Dependencia pesada, comentada no requirements; sem ela o sistema roda normalmente com rotulos por arquivo.
- Instagram/Facebook via yt-dlp sao instaveis e podem exigir cookies (`YTDLP_COOKIES_FILE`). Falha e tratada como cenario esperado, com mensagem clara.
- Download de conteudo de terceiros sem autorizacao viola os Termos de Uso das plataformas: manter a Secao 3 para uso pessoal/interno.
- Producao: trocar `create_all` por Alembic, servir midia via S3/R2 (paths ja centralizados em `MEDIA_DIR`) e restringir CORS.
