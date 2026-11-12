from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user
from database import get_db, row_to_dict, rows_to_dicts
from models import (
    TimelineEventCreate,
    TimelineEventResponse,
    TimelineEventUpdate,
    UserResponse,
)
from routers.wedding_settings import _get_or_create_wedding_id

router = APIRouter(prefix="/timeline", tags=["Timeline"])


@router.get("", response_model=List[TimelineEventResponse])
def get_timeline_events(current_user: UserResponse = Depends(get_current_user)):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            "SELECT * FROM timeline_events WHERE wedding_id = ? ORDER BY time_start ASC, id ASC",
            [wid],
        )
        return rows_to_dicts(res.rows)


@router.post("", response_model=TimelineEventResponse, status_code=status.HTTP_201_CREATED)
def create_timeline_event(
    event: TimelineEventCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            """
            INSERT INTO timeline_events (wedding_id, time_start, title, description, assigned_person)
            VALUES (?, ?, ?, ?, ?)
            RETURNING *
            """,
            [
                wid,
                event.time_start.strip(),
                event.title.strip(),
                event.description.strip() if event.description else None,
                event.assigned_person.strip() if event.assigned_person else None,
            ],
        )
        return row_to_dict(res.rows[0])


@router.put("/{event_id}", response_model=TimelineEventResponse)
def update_timeline_event(
    event_id: int,
    event: TimelineEventUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        existing = client.execute(
            "SELECT * FROM timeline_events WHERE id = ? AND wedding_id = ?",
            [event_id, wid],
        )
        if not existing.rows:
            raise HTTPException(status_code=404, detail="Punkt harmonogramu nie istnieje")

        current_data = row_to_dict(existing.rows[0])
        update_data = event.model_dump(exclude_unset=True)
        merged = {**current_data, **update_data}

        res = client.execute(
            """
            UPDATE timeline_events
            SET time_start = ?, title = ?, description = ?, assigned_person = ?
            WHERE id = ? AND wedding_id = ?
            RETURNING *
            """,
            [
                merged["time_start"].strip(),
                merged["title"].strip(),
                merged["description"].strip() if merged.get("description") else None,
                merged["assigned_person"].strip() if merged.get("assigned_person") else None,
                event_id,
                wid,
            ],
        )
        return row_to_dict(res.rows[0])


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_timeline_event(
    event_id: int,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            "SELECT id FROM timeline_events WHERE id = ? AND wedding_id = ?",
            [event_id, wid],
        )
        if not res.rows:
            raise HTTPException(status_code=404, detail="Punkt harmonogramu nie istnieje")
        client.execute("DELETE FROM timeline_events WHERE id = ? AND wedding_id = ?", [event_id, wid])