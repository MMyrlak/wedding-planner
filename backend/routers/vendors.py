from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from auth import get_current_user
from database import get_db, row_to_dict, rows_to_dicts
from models import (
    UserResponse,
    VendorCandidateCreate,
    VendorCandidateGroupCreate,
    VendorCandidateGroupUpdate,
    VendorCandidatePromote,
    VendorCandidateUpdate,
    VendorCreate,
    VendorResponse,
    VendorUpdate,
)
from routers.wedding_settings import _get_or_create_wedding_id

router = APIRouter(prefix="/vendors", tags=["Vendors"])


@router.get("", response_model=List[VendorResponse])
def get_vendors(
    category: Optional[str] = Query(None),
    contract_signed: Optional[int] = Query(None),
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        query = "SELECT * FROM vendors WHERE wedding_id = ?"
        params: list = [wid]

        if category:
            query += " AND category = ?"
            params.append(category)

        if contract_signed is not None:
            query += " AND contract_signed = ?"
            params.append(contract_signed)

        query += " ORDER BY category ASC, name ASC"

        res = client.execute(query, params)
        return rows_to_dicts(res.rows)


@router.post("", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
def create_vendor(
    vendor: VendorCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            """
            INSERT INTO vendors (wedding_id, category, name, contact_phone, price, contract_signed)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING *
            """,
            [
                wid,
                vendor.category.strip(),
                vendor.name.strip(),
                vendor.contact_phone.strip() if vendor.contact_phone else None,
                vendor.price,
                vendor.contract_signed,
            ],
        )
        return row_to_dict(res.rows[0])


@router.put("/{vendor_id}", response_model=VendorResponse)
def update_vendor(
    vendor_id: int,
    vendor: VendorUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        existing = client.execute(
            "SELECT * FROM vendors WHERE id = ? AND wedding_id = ?",
            [vendor_id, wid],
        )
        if not existing.rows:
            raise HTTPException(status_code=404, detail="Usługodawca nie istnieje")

        current_data = row_to_dict(existing.rows[0])
        update_data = vendor.model_dump(exclude_unset=True)
        merged = {**current_data, **update_data}

        res = client.execute(
            """
            UPDATE vendors
            SET category = ?, name = ?, contact_phone = ?, price = ?, contract_signed = ?
            WHERE id = ? AND wedding_id = ?
            RETURNING *
            """,
            [
                merged["category"].strip(),
                merged["name"].strip(),
                merged["contact_phone"].strip() if merged.get("contact_phone") else None,
                merged["price"],
                merged["contract_signed"],
                vendor_id,
                wid,
            ],
        )
        return row_to_dict(res.rows[0])


@router.delete("/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor(
    vendor_id: int,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            "SELECT id FROM vendors WHERE id = ? AND wedding_id = ?",
            [vendor_id, wid],
        )
        if not res.rows:
            raise HTTPException(status_code=404, detail="Usługodawca nie istnieje")
        client.execute("DELETE FROM vendors WHERE id = ? AND wedding_id = ?", [vendor_id, wid])

# ==========================================
# ROZWAŻANI USŁUGODAWCY (GRUPY I OFERTY)
# ==========================================

@router.get("/candidates/groups")
def get_vendor_candidate_groups(current_user: UserResponse = Depends(get_current_user)):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        groups_res = client.execute(
            """
            SELECT id, wedding_id, name, sort_order, created_at
            FROM vendor_candidate_groups
            WHERE wedding_id = ?
            ORDER BY sort_order ASC, id ASC
            """,
            [wid],
        )
        groups = rows_to_dicts(groups_res.rows)

        cands_res = client.execute(
            """
            SELECT *
            FROM vendor_candidates
            WHERE wedding_id = ?
            ORDER BY
                CASE status
                    WHEN 'chosen' THEN 1
                    WHEN 'meeting' THEN 2
                    WHEN 'contacted' THEN 3
                    WHEN 'considering' THEN 4
                    ELSE 5
                END,
                rating DESC,
                id ASC
            """,
            [wid],
        )
        candidates = rows_to_dicts(cands_res.rows)

    by_group = {}
    for c in candidates:
        by_group.setdefault(c["group_id"], []).append(c)

    for g in groups:
        g["candidates"] = by_group.get(g["id"], [])

    return groups


@router.post("/candidates/groups", status_code=status.HTTP_201_CREATED)
def create_vendor_candidate_group(
    payload: VendorCandidateGroupCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Nazwa grupy nie może być pusta")

    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            """
            INSERT INTO vendor_candidate_groups (wedding_id, name, sort_order)
            VALUES (?, ?, ?)
            RETURNING id, wedding_id, name, sort_order, created_at
            """,
            [wid, clean_name, payload.sort_order],
        )
        group = row_to_dict(res.rows[0])
        group["candidates"] = []
        return group


@router.patch("/candidates/groups/{group_id}")
def update_vendor_candidate_group(
    group_id: int,
    payload: VendorCandidateGroupUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Nazwa grupy nie może być pusta")

    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        if payload.sort_order is not None:
            res = client.execute(
                """
                UPDATE vendor_candidate_groups
                SET name = ?, sort_order = ?
                WHERE id = ? AND wedding_id = ?
                RETURNING id, wedding_id, name, sort_order, created_at
                """,
                [clean_name, payload.sort_order, group_id, wid],
            )
        else:
            res = client.execute(
                """
                UPDATE vendor_candidate_groups
                SET name = ?
                WHERE id = ? AND wedding_id = ?
                RETURNING id, wedding_id, name, sort_order, created_at
                """,
                [clean_name, group_id, wid],
            )

        if not res.rows:
            raise HTTPException(status_code=404, detail="Nie znaleziono grupy")
        return row_to_dict(res.rows[0])


@router.delete("/candidates/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor_candidate_group(
    group_id: int,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        client.execute(
            "DELETE FROM vendor_candidates WHERE group_id = ? AND wedding_id = ?",
            [group_id, wid],
        )
        res = client.execute(
            "DELETE FROM vendor_candidate_groups WHERE id = ? AND wedding_id = ? RETURNING id",
            [group_id, wid],
        )
        if not res.rows:
            raise HTTPException(status_code=404, detail="Nie znaleziono grupy")


@router.post("/candidates", status_code=status.HTTP_201_CREATED)
def create_vendor_candidate(
    payload: VendorCandidateCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        grp = client.execute(
            "SELECT id FROM vendor_candidate_groups WHERE id = ? AND wedding_id = ?",
            [payload.group_id, wid],
        )
        if not grp.rows:
            raise HTTPException(status_code=404, detail="Wybrana grupa nie istnieje")

        res = client.execute(
            """
            INSERT INTO vendor_candidates (
                wedding_id, group_id, name, contact_phone, contact_email,
                website_url, offered_price, rating, pros, cons, notes, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *
            """,
            [
                wid,
                payload.group_id,
                payload.name.strip(),
                payload.contact_phone,
                payload.contact_email,
                payload.website_url,
                payload.offered_price,
                max(0, min(5, payload.rating)),
                payload.pros,
                payload.cons,
                payload.notes,
                payload.status,
            ],
        )
        return row_to_dict(res.rows[0])


@router.patch("/candidates/{candidate_id}")
def update_vendor_candidate(
    candidate_id: int,
    payload: VendorCandidateUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            """
            UPDATE vendor_candidates
            SET group_id = ?, name = ?, contact_phone = ?, contact_email = ?,
                website_url = ?, offered_price = ?, rating = ?, pros = ?,
                cons = ?, notes = ?, status = ?
            WHERE id = ? AND wedding_id = ?
            RETURNING *
            """,
            [
                payload.group_id,
                payload.name.strip(),
                payload.contact_phone,
                payload.contact_email,
                payload.website_url,
                payload.offered_price,
                max(0, min(5, payload.rating)),
                payload.pros,
                payload.cons,
                payload.notes,
                payload.status,
                candidate_id,
                wid,
            ],
        )
        if not res.rows:
            raise HTTPException(status_code=404, detail="Nie znaleziono usługodawcy")
        return row_to_dict(res.rows[0])


@router.delete("/candidates/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor_candidate(
    candidate_id: int,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            "DELETE FROM vendor_candidates WHERE id = ? AND wedding_id = ? RETURNING id",
            [candidate_id, wid],
        )
        if not res.rows:
            raise HTTPException(status_code=404, detail="Nie znaleziono usługodawcy")


@router.post("/candidates/{candidate_id}/promote")
def promote_vendor_candidate(
    candidate_id: int,
    payload: VendorCandidatePromote,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            """
            SELECT vc.*, vcg.name AS group_name
            FROM vendor_candidates vc
            JOIN vendor_candidate_groups vcg ON vc.group_id = vcg.id
            WHERE vc.id = ? AND vc.wedding_id = ?
            """,
            [candidate_id, wid],
        )
        if not res.rows:
            raise HTTPException(status_code=404, detail="Nie znaleziono oferty")

        cand = row_to_dict(res.rows[0])

        client.execute(
            "UPDATE vendor_candidates SET status = 'chosen' WHERE id = ? AND wedding_id = ?",
            [candidate_id, wid],
        )

        client.execute(
            """
            INSERT INTO vendors (wedding_id, category, name, contact_phone, price, contract_signed)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [
                wid,
                cand["group_name"],
                cand["name"],
                cand.get("contact_phone") or "",
                cand.get("offered_price") or 0.0,
                1 if payload.contract_signed else 0,
            ],
        )

        if payload.add_to_budget:
            client.execute(
                """
                INSERT INTO budget_items (wedding_id, category, item_name, estimated_cost, actual_cost, paid)
                VALUES (?, ?, ?, ?, ?, 0)
                """,
                [
                    wid,
                    cand["group_name"],
                    cand["name"],
                    cand.get("offered_price") or 0.0,
                    cand.get("offered_price") or 0.0,
                ],
            )

    return {"status": "promoted"}