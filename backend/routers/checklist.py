from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from auth import get_current_user
from database import get_db, row_to_dict, rows_to_dicts
from models import (
    ChecklistTaskCreate,
    ChecklistTaskResponse,
    ChecklistTaskUpdate,
    UserResponse,
)
from routers.wedding_settings import _get_or_create_wedding_id

router = APIRouter(prefix="/checklist", tags=["Wedding Checklist"])

DEFAULT_STARTER_TASKS = [
    ("12+ miesięcy przed", "Ustalenie wstępnego budżetu i listy gości", "Określenie łącznej puli środków i szacowanej liczby gości.", "Para Młoda"),
    ("12+ miesięcy przed", "Rezerwacja sali weselnej oraz terminu ceremonii", "Podpisanie umowy z lokalem i rezerwacja terminu w kościele/USC.", "Para Młoda"),
    ("12+ miesięcy przed", "Wybór fotografa, kamerzysty i oprawy muzycznej", "Rezerwacja kluczowych usługodawców (DJ / zespół, foto, video).", "Para Młoda"),
    ("6–12 miesięcy przed", "Wybór sukni ślubnej oraz garnituru", "Pierwsze przymiarki i zamówienie kreacji ślubnych.", "Panna Młoda / Pan Młody"),
    ("6–12 miesięcy przed", "Rezerwacja florystki, dekoracji i transportu", "Ustalenie motywu przewodniego, bukietu oraz auta do ślubu.", "Panna Młoda"),
    ("3–6 miesięcy przed", "Zamówienie obrączek ślubnych i zaproszeń", "Personalizacja zaproszeń i wygenerowanie kodów QR RSVP.", "Para Młoda"),
    ("3–6 miesięcy przed", "Rozpoczęcie wręczania zaproszeń gościom", "Oznaczanie wysłanych zaproszeń i zbieranie potwierdzeń RSVP.", "Para Młoda"),
    ("1 miesiąc przed", "Zamknięcie listy gości i potwierdzenie menu na sali", "Przekazanie raportu cateringowego oraz finalnego planu stołów.", "Para Młoda"),
    ("1 miesiąc przed", "Potwierdzenie rezerwacji hotelowych i trasy busa", "Weryfikacja listy pokoi dla recepcji oraz przystanków dla kierowcy.", "Świadkowie"),
    ("Tydzień przed", "Druk winietek, planu stołów i harmonogramu dnia", "Przygotowanie kompletu wydruków na salę i dla usługodawców.", "Świadkowie"),
    ("Tydzień przed", "Uregulowanie zaliczek i przygotowanie kopert na rozliczenia", "Weryfikacja pozostałych rat z harmonogramu płatności.", "Pan Młody"),
]


@router.get("", response_model=List[ChecklistTaskResponse])
def get_checklist_tasks(
    stage: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    is_completed: Optional[int] = Query(None),
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        query = "SELECT * FROM checklist_tasks WHERE wedding_id = ?"
        params: list = [wid]

        if stage:
            query += " AND stage = ?"
            params.append(stage)

        if assigned_to:
            query += " AND assigned_to = ?"
            params.append(assigned_to)

        if is_completed is not None:
            query += " AND is_completed = ?"
            params.append(is_completed)

        query += " ORDER BY is_completed ASC, COALESCE(due_date, '9999-12-31') ASC, id ASC"
        res = client.execute(query, params)
        return rows_to_dicts(res.rows)


@router.post("", response_model=ChecklistTaskResponse, status_code=status.HTTP_201_CREATED)
def create_checklist_task(
    task: ChecklistTaskCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            """
            INSERT INTO checklist_tasks (
                wedding_id, stage, title, description, assigned_to, due_date, is_completed
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING *
            """,
            [
                wid,
                task.stage.strip(),
                task.title.strip(),
                task.description.strip() if task.description else None,
                task.assigned_to.strip() if task.assigned_to else "Para Młoda",
                task.due_date.strip() if task.due_date else None,
                task.is_completed,
            ],
        )
        return row_to_dict(res.rows[0])


@router.post("/seed-defaults", response_model=List[ChecklistTaskResponse])
def seed_default_checklist(current_user: UserResponse = Depends(get_current_user)):
    """
    Dodaje zestaw 11 standardowych zadań przedślubnych pogrupowanych etapami.
    """
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        for stage, title, desc, assignee in DEFAULT_STARTER_TASKS:
            client.execute(
                """
                INSERT INTO checklist_tasks (wedding_id, stage, title, description, assigned_to, is_completed)
                VALUES (?, ?, ?, ?, ?, 0)
                """,
                [wid, stage, title, desc, assignee],
            )

        res = client.execute(
            "SELECT * FROM checklist_tasks WHERE wedding_id = ? ORDER BY is_completed ASC, id ASC",
            [wid],
        )
        return rows_to_dicts(res.rows)


@router.put("/{task_id}", response_model=ChecklistTaskResponse)
def update_checklist_task(
    task_id: int,
    task: ChecklistTaskUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        existing = client.execute(
            "SELECT * FROM checklist_tasks WHERE id = ? AND wedding_id = ?",
            [task_id, wid],
        )
        if not existing.rows:
            raise HTTPException(status_code=404, detail="Zadanie nie istnieje")

        current_data = row_to_dict(existing.rows[0])
        update_data = task.model_dump(exclude_unset=True)
        merged = {**current_data, **update_data}

        res = client.execute(
            """
            UPDATE checklist_tasks
            SET stage = ?, title = ?, description = ?, assigned_to = ?, due_date = ?, is_completed = ?
            WHERE id = ? AND wedding_id = ?
            RETURNING *
            """,
            [
                merged["stage"].strip(),
                merged["title"].strip(),
                merged.get("description"),
                merged.get("assigned_to"),
                merged.get("due_date"),
                merged["is_completed"],
                task_id,
                wid,
            ],
        )
        return row_to_dict(res.rows[0])


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_checklist_task(
    task_id: int,
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        res = client.execute(
            "SELECT id FROM checklist_tasks WHERE id = ? AND wedding_id = ?",
            [task_id, wid],
        )
        if not res.rows:
            raise HTTPException(status_code=404, detail="Zadanie nie istnieje")
        client.execute("DELETE FROM checklist_tasks WHERE id = ? AND wedding_id = ?", [task_id, wid])