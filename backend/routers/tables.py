from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user
from database import get_db, row_to_dict, rows_to_dicts
from models import (
    UserResponse,
    WeddingTableCreate,
    WeddingTableResponse,
    WeddingTableUpdate,
)
from routers.wedding_settings import _get_or_create_wedding_id

router = APIRouter(prefix="/tables", tags=["Wedding Tables"])


@router.get("", response_model=List[WeddingTableResponse])
def get_tables(current_user: UserResponse = Depends(get_current_user)):
    """
    Zwraca listę wszystkich stołów bieżącego wesela wraz z liczbą przypisanych gości.
    """
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            """
            SELECT 
                t.id, 
                t.name, 
                t.capacity, 
                t.shape, 
                COUNT(g.id) AS assigned_count
            FROM wedding_tables t
            LEFT JOIN guests g ON g.table_id = t.id AND g.wedding_id = t.wedding_id
            WHERE t.wedding_id = ?
            GROUP BY t.id, t.name, t.capacity, t.shape
            ORDER BY t.id ASC
            """,
            [wid],
        )
        return rows_to_dicts(res.rows)


@router.post("", response_model=WeddingTableResponse, status_code=status.HTTP_201_CREATED)
def create_table(
    table: WeddingTableCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            """
            INSERT INTO wedding_tables (wedding_id, name, capacity, shape)
            VALUES (?, ?, ?, ?)
            RETURNING id, name, capacity, shape
            """,
            [wid, table.name.strip(), table.capacity, table.shape],
        )
        created = row_to_dict(res.rows[0])
        created["assigned_count"] = 0
        return created


@router.get("/{table_id}", response_model=WeddingTableResponse)
def get_table(
    table_id: int,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            """
            SELECT 
                t.id, 
                t.name, 
                t.capacity, 
                t.shape, 
                COUNT(g.id) AS assigned_count
            FROM wedding_tables t
            LEFT JOIN guests g ON g.table_id = t.id AND g.wedding_id = t.wedding_id
            WHERE t.id = ? AND t.wedding_id = ?
            GROUP BY t.id, t.name, t.capacity, t.shape
            """,
            [table_id, wid],
        )
        if not res.rows:
            raise HTTPException(status_code=404, detail="Stół nie został znaleziony")
        return row_to_dict(res.rows[0])


@router.put("/{table_id}", response_model=WeddingTableResponse)
def update_table(
    table_id: int,
    table: WeddingTableUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        existing = client.execute(
            "SELECT * FROM wedding_tables WHERE id = ? AND wedding_id = ?",
            [table_id, wid],
        )
        if not existing.rows:
            raise HTTPException(status_code=404, detail="Stół nie został znaleziony")

        current_table = row_to_dict(existing.rows[0])
        update_data = table.model_dump(exclude_unset=True)

        if "capacity" in update_data:
            assigned_res = client.execute(
                "SELECT COUNT(*) as count FROM guests WHERE table_id = ? AND wedding_id = ?",
                [table_id, wid],
            )
            assigned_count = row_to_dict(assigned_res.rows[0])["count"]
            if update_data["capacity"] < assigned_count:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Nie można zmniejszyć pojemności stołu poniżej liczby już "
                        f"przypisanych gości ({assigned_count})"
                    ),
                )

        merged = {**current_table, **update_data}

        client.execute(
            """
            UPDATE wedding_tables
            SET name = ?, capacity = ?, shape = ?
            WHERE id = ? AND wedding_id = ?
            """,
            [merged["name"], merged["capacity"], merged["shape"], table_id, wid],
        )

        res = client.execute(
            """
            SELECT 
                t.id, 
                t.name, 
                t.capacity, 
                t.shape, 
                COUNT(g.id) AS assigned_count
            FROM wedding_tables t
            LEFT JOIN guests g ON g.table_id = t.id AND g.wedding_id = t.wedding_id
            WHERE t.id = ? AND t.wedding_id = ?
            GROUP BY t.id, t.name, t.capacity, t.shape
            """,
            [table_id, wid],
        )
        return row_to_dict(res.rows[0])


@router.delete("/{table_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_table(
    table_id: int,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            "SELECT id FROM wedding_tables WHERE id = ? AND wedding_id = ?",
            [table_id, wid],
        )
        if not res.rows:
            raise HTTPException(status_code=404, detail="Stół nie został znaleziony")

        client.execute(
            "UPDATE guests SET table_id = NULL WHERE table_id = ? AND wedding_id = ?",
            [table_id, wid],
        )
        client.execute(
            "DELETE FROM wedding_tables WHERE id = ? AND wedding_id = ?",
            [table_id, wid],
        )