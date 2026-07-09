from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User
from ..core.security import hash_password, verify_password, create_token
from ..core.config import settings
from .deps import current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class Credentials(BaseModel):
    email: EmailStr
    password: str


@router.post("/register")
def register(body: Credentials, db: Session = Depends(get_db)):
    if db.query(User).filter_by(email=body.email).first():
        raise HTTPException(409, "Este email ja tem conta")
    user = User(email=body.email, password_hash=hash_password(body.password))
    db.add(user); db.commit()
    return {"token": create_token(user.id), "email": user.email}


@router.post("/login")
def login(body: Credentials, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Email ou senha incorretos")
    return {"token": create_token(user.id), "email": user.email}


@router.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    used = user.minutes_used_this_month(db)
    return {"email": user.email, "plan": user.plan,
            "minutes_used": round(used, 1), "minutes_limit": settings.FREE_PLAN_MINUTES}
