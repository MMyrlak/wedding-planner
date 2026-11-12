from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from auth import get_current_user
from database import get_db, row_to_dict, rows_to_dicts
from models import (
    BudgetItemCreate,
    BudgetItemResponse,
    BudgetItemUpdate,
    UserResponse,
)
from routers.wedding_settings import _get_or_create_wedding_id

router = APIRouter(prefix="/budget", tags=["Budget"])


@router.get("", response_model=List[BudgetItemResponse])
def get_budget_items(
    category: Optional[str] = Query(None),
    paid: Optional[int] = Query(None),
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        query = "SELECT * FROM budget_items WHERE wedding_id = ?"
        params: list = [wid]

        if category:
            query += " AND category = ?"
            params.append(category)

        if paid is not None:
            query += " AND paid = ?"
            params.append(paid)

        query += " ORDER BY category ASC, id ASC"

        res = client.execute(query, params)
        return rows_to_dicts(res.rows)


@router.post("", response_model=BudgetItemResponse, status_code=status.HTTP_201_CREATED)
def create_budget_item(
    item: BudgetItemCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            """
            INSERT INTO budget_items (wedding_id, category, item_name, estimated_cost, actual_cost, paid)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING *
            """,
            [
                wid,
                item.category.strip(),
                item.item_name.strip(),
                item.estimated_cost,
                item.actual_cost,
                item.paid,
            ],
        )
        return row_to_dict(res.rows[0])


@router.put("/{item_id}", response_model=BudgetItemResponse)
def update_budget_item(
    item_id: int,
    item: BudgetItemUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        existing = client.execute(
            "SELECT * FROM budget_items WHERE id = ? AND wedding_id = ?",
            [item_id, wid],
        )
        if not existing.rows:
            raise HTTPException(status_code=404, detail="Pozycja budżetowa nie istnieje")

        current_data = row_to_dict(existing.rows[0])
        update_data = item.model_dump(exclude_unset=True)
        merged = {**current_data, **update_data}

        res = client.execute(
            """
            UPDATE budget_items
            SET category = ?, item_name = ?, estimated_cost = ?, actual_cost = ?, paid = ?
            WHERE id = ? AND wedding_id = ?
            RETURNING *
            """,
            [
                merged["category"].strip() if isinstance(merged["category"], str) else merged["category"],
                merged["item_name"].strip() if isinstance(merged["item_name"], str) else merged["item_name"],
                merged["estimated_cost"],
                merged["actual_cost"],
                merged["paid"],
                item_id,
                wid,
            ],
        )
        return row_to_dict(res.rows[0])


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget_item(
    item_id: int,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            "SELECT id FROM budget_items WHERE id = ? AND wedding_id = ?",
            [item_id, wid],
        )
        if not res.rows:
            raise HTTPException(status_code=404, detail="Pozycja budżetowa nie istnieje")
        client.execute("DELETE FROM budget_items WHERE id = ? AND wedding_id = ?", [item_id, wid])