import datetime as dt
import jwt
from passlib.context import CryptContext
from .config import settings

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(p: str) -> str: return pwd.hash(p)
def verify_password(p: str, h: str) -> bool: return pwd.verify(p, h)

def create_token(user_id: int) -> str:
    payload = {"sub": str(user_id), "exp": dt.datetime.utcnow() + dt.timedelta(days=30)}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

def decode_token(token: str) -> int | None:
    try:
        return int(jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])["sub"])
    except Exception:
        return None
