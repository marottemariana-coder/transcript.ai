from fastapi import Depends, Header, Query, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..core.security import decode_token
from ..models import User


def _resolve_token(authorization: str, token: str | None, db: Session) -> User | None:
    raw = token or (authorization.removeprefix("Bearer ") if authorization.startswith("Bearer ") else None)
    if not raw:
        return None
    uid = decode_token(raw)
    return db.get(User, uid) if uid else None


def current_user(authorization: str = Header(default=""), token: str | None = Query(default=None),
                 db: Session = Depends(get_db)) -> User:
    user = _resolve_token(authorization, token, db)
    if not user:
        raise HTTPException(401, "Faca login para continuar")
    return user


def optional_user(authorization: str = Header(default=""), token: str | None = Query(default=None),
                  db: Session = Depends(get_db)) -> User | None:
    return _resolve_token(authorization, token, db)
