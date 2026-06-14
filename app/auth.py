import os
import hashlib
import jwt
import time

SECRET = os.getenv("RAPPI_JWT_SECRET", "change-me")
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hash_: str) -> bool:
    return hash_password(password) == hash_


def emit_token(user_id: str, username: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "iat": int(time.time()),
        "exp": int(time.time()) + 86400,
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
