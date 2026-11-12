from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from auth import get_current_user
from database import get_db, row_to_dict, rows_to_dicts
from models import (
    UserResponse,
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