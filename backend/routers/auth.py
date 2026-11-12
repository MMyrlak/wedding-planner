from fastapi import APIRouter, Depends, HTTPException, status

from auth import create_access_token, get_current_user, hash_password, verify_password
from database import get_db, row_to_dict
from models import PasswordChangeRequest, TokenResponse, UserCreate, UserLogin, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate):
    normalized_email = user_data.email.lower().strip()

    with get_db() as client:
        existing = client.execute(
            "SELECT id FROM users WHERE email = ? LIMIT 1",
            [normalized_email],
        )
        if existing.rows:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Użytkownik o podanym adresie email już istnieje",
            )

        users_count_res = client.execute("SELECT COUNT(*) as count FROM users")
        total_users = row_to_dict(users_count_res.rows[0])["count"]

        is_first_user = 1 if total_users == 0 else 0
        is_approved = 1 if is_first_user else 0

        w_name = (user_data.wedding_name or "Nasze Wesele").strip()
        wed_res = client.execute(
            "INSERT INTO weddings (wedding_name) VALUES (?) RETURNING id",
            [w_name],
        )
        new_wedding_id = row_to_dict(wed_res.rows[0])["id"]

        pwd_hash = hash_password(user_data.password)
        role_label = (user_data.role_label or "Para Młoda").strip()

        res = client.execute(
            """
            INSERT INTO users (email, password_hash, is_approved, is_admin, wedding_id, role_label)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING id, email, is_approved, is_admin, wedding_id, role_label, created_at
            """,
            [normalized_email, pwd_hash, is_approved, is_first_user, new_wedding_id, role_label],
        )
        return row_to_dict(res.rows[0])


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin):
    normalized_email = credentials.email.lower().strip()

    with get_db() as client:
        res = client.execute(
            """
            SELECT id, email, password_hash, is_approved, is_admin, wedding_id, role_label
            FROM users WHERE email = ? LIMIT 1
            """,
            [normalized_email],
        )
        if not res.rows:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Nieprawidłowy adres email lub hasło",
            )

        user_record = row_to_dict(res.rows[0])
        if not verify_password(credentials.password, user_record["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Nieprawidłowy adres email lub hasło",
            )

        if user_record.get("is_approved", 0) != 1:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Twoje konto oczekuje na zatwierdzenie przez administratora.",
            )

        token = create_access_token(data={"sub": user_record["email"]})
        return TokenResponse(access_token=token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
def get_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user


@router.post("/change-password")
def change_own_password(
    payload: PasswordChangeRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        res = client.execute(
            "SELECT password_hash FROM users WHERE id = ?",
            [current_user.id],
        )
        if not res.rows:
            raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")

        record = row_to_dict(res.rows[0])
        if not verify_password(payload.current_password, record["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aktualne hasło jest nieprawidłowe",
            )

        new_hash = hash_password(payload.new_password)
        client.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            [new_hash, current_user.id],
        )
        return {"message": "Hasło zostało pomyślnie zmienione."}