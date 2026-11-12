import io
import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
import openpyxl
from pydantic import BaseModel

from auth import get_current_user
from database import get_db, row_to_dict, rows_to_dicts
from models import (
    GuestAssignTable,
    GuestCreate,
    GuestResponse,
    GuestUpdate,
    PublicRSVPSubmit,
    UserResponse,
)
from routers.wedding_settings import _get_or_create_wedding_id

router = APIRouter(prefix="/guests", tags=["Guests"])


class BulkInviteUpdate(BaseModel):
    guest_ids: List[int]
    invite_sent: int = 1


# ==========================================
# PUBLIC ENDPOINTS (BEZ AUTORYZACJI)
# ==========================================

@router.get("/rsvp/{token}", response_model=List[GuestResponse])
def get_rsvp_group_by_token(token: str):
    """
    Pobiera listę gości powiązanych z danym tokenem RSVP (na podstawie rsvp_group_id i wedding_id).
    Dostęp otwarty dla zaproszonych gości.
    """
    with get_db() as client:
        res = client.execute(
            "SELECT rsvp_group_id, id, wedding_id FROM guests WHERE rsvp_token = ? LIMIT 1",
            [token],
        )
        if not res.rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Nie znaleziono zaproszenia dla podanego kodu RSVP",
            )

        row = row_to_dict(res.rows[0])
        group_id = row.get("rsvp_group_id")
        wedding_id = row.get("wedding_id")

        if group_id:
            if wedding_id is not None:
                guests_res = client.execute(
                    "SELECT * FROM guests WHERE rsvp_group_id = ? AND wedding_id = ? ORDER BY id ASC",
                    [group_id, wedding_id],
                )
            else:
                guests_res = client.execute(
                    "SELECT * FROM guests WHERE rsvp_group_id = ? ORDER BY id ASC",
                    [group_id],
                )
        else:
            guests_res = client.execute(
                "SELECT * FROM guests WHERE id = ?",
                [row["id"]],
            )

        return rows_to_dicts(guests_res.rows)


@router.post("/rsvp/{token}", response_model=List[GuestResponse])
def submit_public_rsvp(token: str, payload: PublicRSVPSubmit):
    """
    Zapisuje wybory gości (status obecności, dieta, hotel, transport) przez publiczny formularz RSVP.
    """
    with get_db() as client:
        res = client.execute(
            "SELECT rsvp_group_id, id, wedding_id FROM guests WHERE rsvp_token = ? LIMIT 1",
            [token],
        )
        if not res.rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Nie znaleziono zaproszenia dla podanego kodu RSVP",
            )

        row = row_to_dict(res.rows[0])
        group_id = row.get("rsvp_group_id")
        wedding_id = row.get("wedding_id")

        if group_id:
            if wedding_id is not None:
                allowed_res = client.execute(
                    "SELECT id, needs_transport, transport_pickup, transport_return_time FROM guests WHERE rsvp_group_id = ? AND wedding_id = ?",
                    [group_id, wedding_id],
                )
            else:
                allowed_res = client.execute(
                    "SELECT id, needs_transport, transport_pickup, transport_return_time FROM guests WHERE rsvp_group_id = ?",
                    [group_id],
                )
        else:
            allowed_res = client.execute(
                "SELECT id, needs_transport, transport_pickup, transport_return_time FROM guests WHERE id = ?",
                [row["id"]],
            )

        allowed_map = {r["id"]: r for r in rows_to_dicts(allowed_res.rows)}

        for item in payload.guests:
            if item.id not in allowed_map:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Brak uprawnień do edycji gościa o ID {item.id}",
                )

            existing_g = allowed_map[item.id]
            needs_tr = item.needs_transport if item.needs_transport is not None else (existing_g.get("needs_transport") or 0)
            tr_pickup = item.transport_pickup if item.transport_pickup is not None else existing_g.get("transport_pickup")
            tr_return = item.transport_return_time if item.transport_return_time is not None else existing_g.get("transport_return_time")

            client.execute(
                """
                UPDATE guests
                SET rsvp_status = ?, diet = ?, needs_hotel = ?,
                    needs_transport = ?, transport_pickup = ?, transport_return_time = ?
                WHERE id = ?
                """,
                [item.rsvp_status, item.diet, item.needs_hotel, needs_tr, tr_pickup, tr_return, item.id],
            )

        if group_id:
            if wedding_id is not None:
                updated = client.execute(
                    "SELECT * FROM guests WHERE rsvp_group_id = ? AND wedding_id = ? ORDER BY id ASC",
                    [group_id, wedding_id],
                )
            else:
                updated = client.execute(
                    "SELECT * FROM guests WHERE rsvp_group_id = ? ORDER BY id ASC",
                    [group_id],
                )
        else:
            updated = client.execute(
                "SELECT * FROM guests WHERE id = ?",
                [row["id"]],
            )

        return rows_to_dicts(updated.rows)


# ==========================================
# CHRONIONE ENDPOINTY ORGANIZATORA
# ==========================================

@router.get("", response_model=List[GuestResponse])
def get_guests(
    rsvp_status: Optional[str] = Query(None),
    table_id: Optional[str] = Query(None),
    diet: Optional[str] = Query(None),
    needs_hotel: Optional[int] = Query(None),
    needs_transport: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        query = "SELECT * FROM guests WHERE wedding_id = ?"
        params: list = [wid]

        if rsvp_status:
            query += " AND rsvp_status = ?"
            params.append(rsvp_status)

        if table_id:
            if table_id.lower() == "unassigned":
                query += " AND table_id IS NULL"
            else:
                query += " AND table_id = ?"
                params.append(int(table_id))

        if diet:
            query += " AND diet = ?"
            params.append(diet)

        if needs_hotel is not None:
            query += " AND needs_hotel = ?"
            params.append(needs_hotel)

        if needs_transport is not None:
            query += " AND needs_transport = ?"
            params.append(needs_transport)

        if search:
            query += " AND (first_name LIKE ? OR last_name LIKE ?)"
            wildcard = f"%{search}%"
            params.extend([wildcard, wildcard])

        query += " ORDER BY last_name ASC, first_name ASC"

        res = client.execute(query, params)
        return rows_to_dicts(res.rows)


@router.post("", response_model=GuestResponse, status_code=status.HTTP_201_CREATED)
def create_guest(
    guest: GuestCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)

        if guest.table_id is not None:
            table_res = client.execute(
                "SELECT capacity FROM wedding_tables WHERE id = ? AND wedding_id = ?",
                [guest.table_id, wid],
            )
            if not table_res.rows:
                raise HTTPException(status_code=400, detail="Wybrany stół nie istnieje")
            capacity = row_to_dict(table_res.rows[0])["capacity"]

            count_res = client.execute(
                "SELECT COUNT(*) as count FROM guests WHERE table_id = ? AND wedding_id = ?",
                [guest.table_id, wid],
            )
            current_count = row_to_dict(count_res.rows[0])["count"]

            if current_count >= capacity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stół jest pełny (pojemność: {capacity})",
                )

        token = guest.rsvp_token or secrets.token_urlsafe(10)
        group_id = guest.rsvp_group_id or secrets.token_hex(4)

        res = client.execute(
            """
            INSERT INTO guests (
                wedding_id, table_id, first_name, last_name, age_category,
                rsvp_status, diet, needs_hotel, room_number, nights_count,
                accommodation_payer, invitation_salutation, needs_transport,
                transport_pickup, transport_return_time, seating_notes,
                rsvp_group_id, rsvp_token, invite_sent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *
            """,
            [
                wid,
                guest.table_id,
                guest.first_name.strip(),
                guest.last_name.strip(),
                guest.age_category,
                guest.rsvp_status,
                guest.diet.strip(),
                guest.needs_hotel,
                guest.room_number.strip() if guest.room_number else None,
                guest.nights_count,
                guest.accommodation_payer,
                guest.invitation_salutation.strip() if guest.invitation_salutation else None,
                guest.needs_transport,
                guest.transport_pickup.strip() if guest.transport_pickup else None,
                guest.transport_return_time.strip() if guest.transport_return_time else None,
                guest.seating_notes.strip() if guest.seating_notes else None,
                group_id,
                token,
                guest.invite_sent,
            ],
        )
        return row_to_dict(res.rows[0])


@router.get("/export/xlsx")
def export_guests_xlsx(current_user: UserResponse = Depends(get_current_user)):
    """
    Eksportuje pełną listę gości bieżącego wesela do arkusza Excel (.xlsx).
    """
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            """
            SELECT 
                g.id, g.first_name, g.last_name, g.age_category,
                g.rsvp_status, g.diet, g.needs_hotel, g.room_number,
                g.nights_count, g.accommodation_payer, g.invitation_salutation,
                g.needs_transport, g.transport_pickup, g.transport_return_time,
                g.seating_notes, g.invite_sent, g.rsvp_token, g.rsvp_group_id,
                t.name as table_name
            FROM guests g
            LEFT JOIN wedding_tables t ON g.table_id = t.id
            WHERE g.wedding_id = ?
            ORDER BY t.name ASC, g.last_name ASC
            """,
            [wid],
        )
        guest_records = rows_to_dicts(res.rows)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Lista Gości"

    headers = [
        "ID", "Imię", "Nazwisko", "Kategoria wiekowa", "Status RSVP",
        "Dieta", "Hotel", "Pokój", "Liczba dób", "Płatnik noclegu",
        "Transport", "Przystanek odbioru", "Powrót", "Stół",
        "Notatki stolikowe", "Wysłano zaproszenie", "Kod RSVP", "Grupa zaproszenia"
    ]
    ws.append(headers)

    for g in guest_records:
        payer_label = "Para Młoda" if g.get("accommodation_payer") != "guest" else "Gość"
        ws.append([
            g["id"],
            g["first_name"],
            g["last_name"],
            g["age_category"],
            g["rsvp_status"],
            g["diet"],
            "Tak" if g["needs_hotel"] == 1 else "Nie",
            g.get("room_number") or "",
            g.get("nights_count") or 1,
            payer_label if g["needs_hotel"] == 1 else "-",
            "Tak" if g.get("needs_transport") == 1 else "Nie",
            g.get("transport_pickup") or "",
            g.get("transport_return_time") or "",
            g["table_name"] or "Brak (nieprzypisany)",
            g.get("seating_notes") or "",
            "Tak" if g["invite_sent"] == 1 else "Nie",
            g["rsvp_token"],
            g["rsvp_group_id"],
        ])

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    filename = "lista_gosci_weselnych.xlsx"
    headers_resp = {
        "Content-Disposition": f'attachment; filename="{filename}"'
    }
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers_resp,
    )


@router.post("/import/xlsx")
async def import_guests_xlsx(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Importuje gości z pliku .xlsx do bieżącego wesela.
    """
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Nieprawidłowy format pliku. Wymagany arkusz Excel (.xlsx)",
        )

    contents = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents))
    ws = wb.active

    imported_count = 0
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row or not row[0] or not row[1]:
                continue

            first_name = str(row[0]).strip()
            last_name = str(row[1]).strip()
            age_cat = str(row[2]).strip().lower() if len(row) > 2 and row[2] else "adult"
            if age_cat not in ["adult", "child", "toddler"]:
                age_cat = "adult"

            diet = str(row[3]).strip() if len(row) > 3 and row[3] else "standard"
            needs_hotel = 1 if len(row) > 4 and str(row[4]).strip().lower() in ["1", "tak", "true"] else 0

            token = secrets.token_urlsafe(10)
            group_id = secrets.token_hex(4)

            client.execute(
                """
                INSERT INTO guests (
                    wedding_id, first_name, last_name, age_category, rsvp_status,
                    diet, needs_hotel, rsvp_group_id, rsvp_token, invite_sent
                ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, 0)
                """,
                [wid, first_name, last_name, age_cat, diet, needs_hotel, group_id, token],
            )
            imported_count += 1

    return {"message": f"Pomyślnie zaimportowano {imported_count} gości."}


@router.post("/bulk/generate-tokens")
def bulk_generate_missing_tokens(
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            "SELECT id, rsvp_group_id FROM guests WHERE rsvp_token IS NULL AND wedding_id = ?",
            [wid],
        )
        rows = rows_to_dicts(res.rows)
        updated_count = 0

        for r in rows:
            token = secrets.token_urlsafe(10)
            group_id = r["rsvp_group_id"] or secrets.token_hex(4)
            client.execute(
                "UPDATE guests SET rsvp_token = ?, rsvp_group_id = ? WHERE id = ? AND wedding_id = ?",
                [token, group_id, r["id"], wid],
            )
            updated_count += 1

        return {"message": f"Wygenerowano tokeny dla {updated_count} gości."}


@router.patch("/bulk/invites")
def bulk_update_invites(
    payload: BulkInviteUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    if not payload.guest_ids:
        return {"updated": 0}

    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        placeholders = ",".join(["?"] * len(payload.guest_ids))
        params = [payload.invite_sent, wid] + payload.guest_ids
        client.execute(
            f"UPDATE guests SET invite_sent = ? WHERE wedding_id = ? AND id IN ({placeholders})",
            params,
        )
        return {"updated": len(payload.guest_ids), "invite_sent": payload.invite_sent}


@router.put("/{guest_id}", response_model=GuestResponse)
def update_guest(
    guest_id: int,
    guest: GuestUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        existing = client.execute(
            "SELECT * FROM guests WHERE id = ? AND wedding_id = ?",
            [guest_id, wid],
        )
        if not existing.rows:
            raise HTTPException(status_code=404, detail="Gość nie istnieje")

        current_data = row_to_dict(existing.rows[0])
        update_data = guest.model_dump(exclude_unset=True)

        if "table_id" in update_data and update_data["table_id"] is not None:
            target_table_id = update_data["table_id"]
            table_res = client.execute(
                "SELECT capacity FROM wedding_tables WHERE id = ? AND wedding_id = ?",
                [target_table_id, wid],
            )
            if not table_res.rows:
                raise HTTPException(status_code=400, detail="Wybrany stół nie istnieje")
            capacity = row_to_dict(table_res.rows[0])["capacity"]

            count_res = client.execute(
                "SELECT COUNT(*) as count FROM guests WHERE table_id = ? AND wedding_id = ? AND id != ?",
                [target_table_id, wid, guest_id],
            )
            current_count = row_to_dict(count_res.rows[0])["count"]

            if current_count >= capacity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stół jest pełny (pojemność: {capacity})",
                )

        merged = {**current_data, **update_data}

        res = client.execute(
            """
            UPDATE guests
            SET table_id = ?, first_name = ?, last_name = ?, age_category = ?,
                rsvp_status = ?, diet = ?, needs_hotel = ?, room_number = ?,
                nights_count = ?, accommodation_payer = ?, invitation_salutation = ?,
                needs_transport = ?, transport_pickup = ?, transport_return_time = ?,
                seating_notes = ?, rsvp_group_id = ?, rsvp_token = ?, invite_sent = ?
            WHERE id = ? AND wedding_id = ?
            RETURNING *
            """,
            [
                merged["table_id"],
                merged["first_name"],
                merged["last_name"],
                merged["age_category"],
                merged["rsvp_status"],
                merged["diet"],
                merged["needs_hotel"],
                merged.get("room_number"),
                merged.get("nights_count") or 1,
                merged.get("accommodation_payer") or "couple",
                merged.get("invitation_salutation"),
                merged.get("needs_transport") or 0,
                merged.get("transport_pickup"),
                merged.get("transport_return_time"),
                merged.get("seating_notes"),
                merged["rsvp_group_id"],
                merged["rsvp_token"],
                merged["invite_sent"],
                guest_id,
                wid,
            ],
        )
        return row_to_dict(res.rows[0])


@router.patch("/{guest_id}/assign-table", response_model=GuestResponse)
def assign_guest_table(
    guest_id: int,
    payload: GuestAssignTable,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        guest_res = client.execute(
            "SELECT * FROM guests WHERE id = ? AND wedding_id = ?",
            [guest_id, wid],
        )
        if not guest_res.rows:
            raise HTTPException(status_code=404, detail="Gość nie istnieje")

        target_table_id = payload.table_id

        if target_table_id is not None:
            table_res = client.execute(
                "SELECT capacity FROM wedding_tables WHERE id = ? AND wedding_id = ?",
                [target_table_id, wid],
            )
            if not table_res.rows:
                raise HTTPException(status_code=400, detail="Wybrany stół nie istnieje")
            capacity = row_to_dict(table_res.rows[0])["capacity"]

            count_res = client.execute(
                "SELECT COUNT(*) as count FROM guests WHERE table_id = ? AND wedding_id = ? AND id != ?",
                [target_table_id, wid, guest_id],
            )
            current_count = row_to_dict(count_res.rows[0])["count"]

            if current_count >= capacity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Brak wolnych miejsc przy stole (limit: {capacity})",
                )

        res = client.execute(
            "UPDATE guests SET table_id = ? WHERE id = ? AND wedding_id = ? RETURNING *",
            [target_table_id, guest_id, wid],
        )
        return row_to_dict(res.rows[0])


@router.delete("/{guest_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_guest(
    guest_id: int,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            "SELECT id FROM guests WHERE id = ? AND wedding_id = ?",
            [guest_id, wid],
        )
        if not res.rows:
            raise HTTPException(status_code=404, detail="Gość nie istnieje")
        client.execute("DELETE FROM guests WHERE id = ? AND wedding_id = ?", [guest_id, wid])