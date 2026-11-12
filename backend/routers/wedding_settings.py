from datetime import datetime, timezone
import io
import json
from typing import List, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
import openpyxl
from openpyxl.styles import Font, PatternFill

from auth import get_current_user, hash_password
from database import get_db, row_to_dict, rows_to_dicts
from models import (
    UserResponse,
    WeddingMemberCreate,
    WeddingMemberResponse,
    WeddingSettingsResponse,
    WeddingSettingsUpdate,
)

router = APIRouter(prefix="/wedding", tags=["Wedding Settings & Members"])


def _get_or_create_wedding_id(client, current_user: UserResponse) -> int:
    if current_user.wedding_id:
        return current_user.wedding_id

    res = client.execute("INSERT INTO weddings (wedding_name) VALUES ('Nasze Wesele') RETURNING id")
    wid = row_to_dict(res.rows[0])["id"]
    client.execute("UPDATE users SET wedding_id = ? WHERE id = ?", [wid, current_user.id])
    return wid


def build_wedding_backup_payload(client, wid: int) -> dict:
    wed_res = client.execute("SELECT * FROM weddings WHERE id = ?", [wid])
    wedding_data = row_to_dict(wed_res.rows[0]) if wed_res.rows else {}

    users_res = client.execute(
        "SELECT id, email, role_label, is_approved, is_admin, created_at FROM users WHERE wedding_id = ?",
        [wid],
    )
    tables_res = client.execute("SELECT * FROM wedding_tables WHERE wedding_id = ? ORDER BY id ASC", [wid])
    guests_res = client.execute("SELECT * FROM guests WHERE wedding_id = ? ORDER BY id ASC", [wid])
    budget_res = client.execute("SELECT * FROM budget_items WHERE wedding_id = ? ORDER BY id ASC", [wid])
    inst_res = client.execute("SELECT * FROM budget_installments WHERE wedding_id = ? ORDER BY id ASC", [wid])
    tasks_res = client.execute("SELECT * FROM checklist_tasks WHERE wedding_id = ? ORDER BY id ASC", [wid])
    timeline_res = client.execute("SELECT * FROM timeline_events WHERE wedding_id = ? ORDER BY time_start ASC", [wid])
    vendors_res = client.execute("SELECT * FROM vendors WHERE wedding_id = ? ORDER BY id ASC", [wid])

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "wedding": wedding_data,
        "team_members": rows_to_dicts(users_res.rows),
        "wedding_tables": rows_to_dicts(tables_res.rows),
        "guests": rows_to_dicts(guests_res.rows),
        "budget_items": rows_to_dicts(budget_res.rows),
        "budget_installments": rows_to_dicts(inst_res.rows),
        "checklist_tasks": rows_to_dicts(tasks_res.rows),
        "timeline_events": rows_to_dicts(timeline_res.rows),
        "vendors": rows_to_dicts(vendors_res.rows),
    }


def build_wedding_backup_xlsx(payload: dict) -> io.BytesIO:
    wb = openpyxl.Workbook()
    header_fill = PatternFill(start_color="059669", end_color="059669", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)

    # 1. Arkusz Podsumowanie / Konfiguracja
    ws_info = wb.active
    ws_info.title = "Konfiguracja Wesela"
    ws_info.append(["Parametr", "Wartość"])
    for c in ws_info[1]:
        c.fill = header_fill
        c.font = header_font
    for k, v in payload.get("wedding", {}).items():
        ws_info.append([str(k), str(v) if v is not None else ""])

    sections = [
        ("Goście", payload.get("guests", [])),
        ("Stoły", payload.get("wedding_tables", [])),
        ("Budżet", payload.get("budget_items", [])),
        ("Raty i Zaliczki", payload.get("budget_installments", [])),
        ("Checklista", payload.get("checklist_tasks", [])),
        ("Harmonogram Dnia", payload.get("timeline_events", [])),
        ("Usługodawcy", payload.get("vendors", [])),
        ("Zespół Organizacyjny", payload.get("team_members", [])),
    ]

    for sheet_title, rows in sections:
        ws = wb.create_sheet(title=sheet_title)
        if not rows:
            ws.append(["Brak zapisanych danych w tej sekcji"])
            continue
        headers = list(rows[0].keys())
        ws.append(headers)
        for c in ws[1]:
            c.fill = header_fill
            c.font = header_font
        for r in rows:
            ws.append([r.get(h) for h in headers])

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream


@router.get("/backup")
def download_wedding_backup(
    format: Literal["json", "xlsx"] = Query("xlsx"),
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Pobiera pełną kopię zapasową bieżącego wesela (do pracy offline na sali).
    """
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        payload = build_wedding_backup_payload(client, wid)

    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    if format == "json":
        raw_json = json.dumps(payload, ensure_ascii=False, indent=2, default=str).encode("utf-8")
        return StreamingResponse(
            io.BytesIO(raw_json),
            media_type="application/json; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="backup_wesela_{stamp}.json"'},
        )

    stream = build_wedding_backup_xlsx(payload)
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="backup_wesela_{stamp}.xlsx"'},
    )


@router.get("/settings", response_model=WeddingSettingsResponse)
def get_wedding_settings(current_user: UserResponse = Depends(get_current_user)):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute("SELECT * FROM weddings WHERE id = ?", [wid])
        if not res.rows:
            raise HTTPException(status_code=404, detail="Nie znaleziono konfiguracji wesela")
        return row_to_dict(res.rows[0])


@router.put("/settings", response_model=WeddingSettingsResponse)
def update_wedding_settings(
    payload: WeddingSettingsUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        existing_res = client.execute("SELECT * FROM weddings WHERE id = ?", [wid])
        if not existing_res.rows:
            raise HTTPException(status_code=404, detail="Nie znaleziono konfiguracji wesela")

        current_data = row_to_dict(existing_res.rows[0])
        update_data = payload.model_dump(exclude_unset=True)
        merged = {**current_data, **update_data}

        res = client.execute(
            """
            UPDATE weddings
            SET wedding_name = ?,
                wedding_date = ?,
                venue_name = ?,
                adult_weight = ?,
                child_weight = ?,
                toddler_weight = ?,
                adult_age_desc = ?,
                child_age_desc = ?,
                toddler_age_desc = ?,
                plate_price = ?,
                afterparty_price = ?,
                hotel_price = ?,
                theme_color = ?
            WHERE id = ?
            RETURNING *
            """,
            [
                merged["wedding_name"].strip(),
                merged.get("wedding_date"),
                merged.get("venue_name"),
                float(merged["adult_weight"]),
                float(merged["child_weight"]),
                float(merged["toddler_weight"]),
                merged["adult_age_desc"].strip(),
                merged["child_age_desc"].strip(),
                merged["toddler_age_desc"].strip(),
                float(merged["plate_price"]),
                float(merged["afterparty_price"]),
                float(merged["hotel_price"]),
                merged["theme_color"],
                wid,
            ],
        )
        return row_to_dict(res.rows[0])


@router.get("/members", response_model=List[WeddingMemberResponse])
def get_wedding_members(current_user: UserResponse = Depends(get_current_user)):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            """
            SELECT id, email, role_label, is_approved, is_admin, created_at
            FROM users
            WHERE wedding_id = ?
            ORDER BY id ASC
            """,
            [wid],
        )
        return rows_to_dicts(res.rows)


@router.post("/members", response_model=WeddingMemberResponse, status_code=status.HTTP_201_CREATED)
def add_wedding_member(
    payload: WeddingMemberCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    normalized_email = payload.email.lower().strip()
    role_label = payload.role_label.strip()

    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        existing_res = client.execute(
            "SELECT id, email, wedding_id FROM users WHERE email = ? LIMIT 1",
            [normalized_email],
        )

        if existing_res.rows:
            existing_user = row_to_dict(existing_res.rows[0])
            if existing_user.get("wedding_id") == wid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="To konto jest już przypisane do tego wesela.",
                )

            upd = client.execute(
                """
                UPDATE users
                SET wedding_id = ?, role_label = ?, is_approved = 1
                WHERE id = ?
                RETURNING id, email, role_label, is_approved, is_admin, created_at
                """,
                [wid, role_label, existing_user["id"]],
            )
            return row_to_dict(upd.rows[0])

        if not payload.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dla nowego adresu e-mail wymagane jest podanie hasła startowego (min. 6 znaków).",
            )

        pwd_hash = hash_password(payload.password)
        ins = client.execute(
            """
            INSERT INTO users (email, password_hash, is_approved, is_admin, wedding_id, role_label)
            VALUES (?, ?, 1, 0, ?, ?)
            RETURNING id, email, role_label, is_approved, is_admin, created_at
            """,
            [normalized_email, pwd_hash, wid, role_label],
        )
        return row_to_dict(ins.rows[0])


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_wedding_member(
    member_id: int,
    current_user: UserResponse = Depends(get_current_user),
):
    if member_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nie możesz usunąć samego siebie z zespołu organizacyjnego.",
        )

    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        target_res = client.execute(
            "SELECT id, is_admin FROM users WHERE id = ? AND wedding_id = ?",
            [member_id, wid],
        )
        if not target_res.rows:
            raise HTTPException(status_code=404, detail="Nie znaleziono członka zespołu w tym weselu.")

        target = row_to_dict(target_res.rows[0])
        if target.get("is_admin") == 1:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Nie można usunąć głównego administratora systemu.",
            )

        client.execute("DELETE FROM users WHERE id = ?", [member_id])