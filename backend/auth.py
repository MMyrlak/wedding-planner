import os
from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from database import get_db, row_to_dict
from models import TokenData, UserResponse

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "wedding-planner-2026-mim-1228")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

security = HTTPBearer()


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode("utf-8")
    hash_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(pwd_bytes, hash_bytes)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> TokenData:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Nieprawidłowy token autoryzacyjny lub sesja wygasła",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        email: Optional[str] = payload.get("sub")
        if email is None:
            raise credentials_exception
        return TokenData(email=email)
    except jwt.PyJWTError:
        raise credentials_exception


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> UserResponse:
    token = credentials.credentials
    token_data = decode_access_token(token)

    with get_db() as client:
        result = client.execute(
            """
            SELECT id, email, is_approved, is_admin, wedding_id, role_label, created_at
            FROM users
            WHERE email = ? LIMIT 1
            """,
            [token_data.email],
        )
        if not result.rows:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Użytkownik powiązany z tokenem nie istnieje",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_dict = row_to_dict(result.rows[0])
        return UserResponse(**user_dict)


def get_current_admin(
    current_user: UserResponse = Depends(get_current_user),
) -> UserResponse:
    if current_user.is_admin != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Wymagane uprawnienia administratora systemu",
        )
    return current_user