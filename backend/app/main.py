from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import Base, engine
from .api import auth, jobs, transcripts, analyze

app = FastAPI(title="transcript.ai")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def init_db():
    Base.metadata.create_all(engine)  # em producao, migrar para Alembic


app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(transcripts.router)
app.include_router(analyze.router)


@app.get("/health")
def health():
    return {"ok": True}
