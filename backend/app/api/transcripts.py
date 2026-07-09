from fastapi import APIRouter, Depends, HTTPException, Header, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Transcript, Translation, User, SpeakerProfile
from ..services.translation import translate_segments
from ..services import ai_features, voice_library
from ..services import exporters
from .deps import optional_user, current_user, require_pro

router = APIRouter(prefix="/transcripts", tags=["transcripts"])


def _get(db: Session, tid: int, user: User | None, anon_id: str | None) -> Transcript:
    t = db.get(Transcript, tid)
    if not t:
        raise HTTPException(404, "Transcricao nao encontrada")
    job = t.job
    if job.user_id and (not user or user.id != job.user_id):
        raise HTTPException(404, "Transcricao nao encontrada")
    if job.anon_id and not user and job.anon_id != anon_id:
        raise HTTPException(404, "Transcricao nao encontrada")
    return t


@router.get("/{tid}")
def get_transcript(tid: int, x_anon_id: str = Header(default=None),
                   user: User | None = Depends(optional_user), db: Session = Depends(get_db)):
    t = _get(db, tid, user, x_anon_id)
    return {"id": t.id, "text": t.text, "segments": t.segments, "language": t.language,
            "job_id": t.job_id, "filename": t.job.original_filename,
            "translations": [{"id": tr.id, "lang": tr.target_language} for tr in t.translations]}


class SegmentEdit(BaseModel):
    index: int
    text: str


@router.patch("/{tid}/segments")
def edit_segment(tid: int, body: SegmentEdit, x_anon_id: str = Header(default=None),
                 user: User | None = Depends(optional_user), db: Session = Depends(get_db)):
    """Editor embutido: corrigir texto de um segmento."""
    t = _get(db, tid, user, x_anon_id)
    segs = list(t.segments)
    if not 0 <= body.index < len(segs):
        raise HTTPException(422, "Segmento inexistente")
    segs[body.index] = {**segs[body.index], "text": body.text}
    t.segments = segs
    t.text = " ".join(s["text"] for s in segs)
    db.commit()
    return {"ok": True}


class RenameSpeaker(BaseModel):
    old_label: str
    new_name: str
    save_to_library: bool = True


@router.post("/{tid}/speakers/rename")
def rename_speaker(tid: int, body: RenameSpeaker,
                   user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Renomeia locutor e salva a voz na biblioteca persistente (Secao 7)."""
    t = _get(db, tid, user, None)
    t.segments = [{**s, "speaker": body.new_name if s.get("speaker") == body.old_label else s.get("speaker")}
                  for s in t.segments]
    db.commit()
    saved = False
    if body.save_to_library and voice_library.AVAILABLE and t.job.audio_path:
        emb = voice_library.embed_speaker(t.job.audio_path, t.segments, body.new_name)
        if emb:
            db.add(SpeakerProfile(user_id=user.id, name=body.new_name, embedding=emb))
            db.commit()
            saved = True
    return {"ok": True, "saved_to_library": saved,
            "note": None if voice_library.AVAILABLE else
            "Biblioteca de vozes inativa: instale speechbrain para reconhecimento entre arquivos"}


class TranslateBody(BaseModel):
    target_language: str


@router.post("/{tid}/translate")
def translate(tid: int, body: TranslateBody,
              user: User = Depends(require_pro), db: Session = Depends(get_db)):
    """Traducao pos-transcricao para qualquer idioma (Secao 4), lado a lado com o original."""
    t = _get(db, tid, user, None)
    existing = next((tr for tr in t.translations if tr.target_language == body.target_language), None)
    if existing:
        return {"id": existing.id, "lang": existing.target_language,
                "text": existing.text, "segments": existing.segments}
    result = translate_segments(t.segments, t.text, body.target_language)
    tr = Translation(transcript_id=t.id, target_language=body.target_language,
                     text=result["text"], segments=result["segments"])
    db.add(tr); db.commit()
    return {"id": tr.id, "lang": tr.target_language, "text": tr.text, "segments": tr.segments}


@router.get("/{tid}/export/{fmt}")
def export(tid: int, fmt: str, translation_id: int | None = None,
           x_anon_id: str = Header(default=None),
           user: User | None = Depends(optional_user), db: Session = Depends(get_db)):
    t = _get(db, tid, user, x_anon_id)
    segments, suffix = t.segments, ""
    if translation_id:
        tr = db.get(Translation, translation_id)
        if not tr or tr.transcript_id != t.id:
            raise HTTPException(404, "Traducao nao encontrada")
        segments, suffix = tr.segments, f"-{tr.target_language}"
    title = (t.job.original_filename or f"transcricao-{t.id}") + suffix
    fns = {"txt": exporters.to_txt, "srt": exporters.to_srt, "vtt": exporters.to_vtt,
           "json": lambda s: exporters.to_json(s, {"title": title, "language": t.language}),
           "html": lambda s: exporters.to_html(s, title),
           "docx": lambda s: exporters.to_docx(s, title),
           "pdf": lambda s: exporters.to_pdf(s, title),
           "fcpxml": lambda s: exporters.to_fcpxml(s, title)}
    if fmt not in fns:
        raise HTTPException(422, f"Formato invalido. Use: {', '.join(fns)}")
    content = fns[fmt](segments)
    media = exporters.EXPORTERS.get(fmt, ("application/octet-stream", None))[0]
    return Response(content, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{title}.{fmt}"'})


class ChatBody(BaseModel):
    question: str
    history: list = []
    style: str = "instagram"
    custom_style: str | None = None


@router.post("/{tid}/ai/{feature}")
def ai(tid: int, feature: str, body: ChatBody | None = None,
       user: User = Depends(require_pro), db: Session = Depends(get_db)):
    """Secao 8: resumo, citacoes, mapa mental, roteiro e chat com o video."""
    t = _get(db, tid, user, None)
    if feature == "summary":
        return {"result": ai_features.summarize(t.text)}
    if feature == "quotes":
        return {"result": ai_features.extract_quotes(t.text)}
    if feature == "mindmap":
        return {"result": ai_features.mind_map(t.text)}
    if feature == "script":
        return {"result": ai_features.write_script(t.text)}
    if feature == "caption" and body:
        return {"result": ai_features.generate_caption(t.text, body.style or "instagram", body.custom_style)}
    if feature == "chat" and body:
        return {"result": ai_features.chat(t.text, body.question, body.history)}
    raise HTTPException(422, "Recurso invalido. Use: summary, quotes, mindmap, script, caption, chat")
