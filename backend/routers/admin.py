from datetime import datetime, timezone
import io
import json
import os
import platform
import sys
import time
from typing import List, Literal
import psutil
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from auth import get_current_admin, hash_password
from database import get_db, row_to_dict, rows_to_dicts
from models import (
    AdminSystemMetricsResponse,
    DatabaseMetrics,
    ServerMetrics,
    TableStat,
    UserPasswordReset,
    UserResponse,
    UserStatusUpdate,
)

router = APIRouter(prefix="/admin", tags=["Admin Panel"])

PROCESS_START_TIME = time.time()


@router.get("/users", response_model=List[UserResponse])
def get_all_users(admin: UserResponse = Depends(get_current_admin)):
    with get_db() as client:
        res = client.execute(
            "SELECT id, email, is_approved, is_admin, wedding_id, role_label, created_at FROM users ORDER BY id ASC"
        )
        return rows_to_dicts(res.rows)


@router.patch("/users/{user_id}/status", response_model=UserResponse)
def update_user_approval_status(
    user_id: int,
    payload: UserStatusUpdate,
    admin: UserResponse = Depends(get_current_admin),
):
    with get_db() as client:
        user_res = client.execute("SELECT * FROM users WHERE id = ?", [user_id])
        if not user_res.rows:
            raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")

        target_user = row_to_dict(user_res.rows[0])
        if target_user["id"] == admin.id and payload.is_approved == 0:
            raise HTTPException(
                status_code=400,
                detail="Nie możesz zablokować własnego konta administratora.",
            )

        res = client.execute(
            """
            UPDATE users
            SET is_approved = ?
            WHERE id = ?
            RETURNING id, email, is_approved, is_admin, wedding_id, role_label, created_at
            """,
            [payload.is_approved, user_id],
        )
        return row_to_dict(res.rows[0])


@router.patch("/users/{user_id}/reset-password")
def admin_reset_user_password(
    user_id: int,
    payload: UserPasswordReset,
    admin: UserResponse = Depends(get_current_admin),
):
    """Pozwala administratorowi zresetować hasło wybranego użytkownika."""
    with get_db() as client:
        user_res = client.execute("SELECT id, email FROM users WHERE id = ?", [user_id])
        if not user_res.rows:
            raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")

        target = row_to_dict(user_res.rows[0])
        new_hash = hash_password(payload.new_password)
        client.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            [new_hash, user_id],
        )
        return {"message": f"Hasło dla konta {target['email']} zostało zresetowane."}


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    admin: UserResponse = Depends(get_current_admin),
):
    if user_id == admin.id:
        raise HTTPException(
            status_code=400,
            detail="Nie możesz usunąć aktualnie zalogowanego konta administratora.",
        )

    with get_db() as client:
        res = client.execute("SELECT id FROM users WHERE id = ?", [user_id])
        if not res.rows:
            raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")
        client.execute("DELETE FROM users WHERE id = ?", [user_id])


@router.get("/backup-all")
def download_full_database_backup(
    admin: UserResponse = Depends(get_current_admin),
):
    """Pobiera pełny zrzut całej bazy danych Turso (wszystkie wesela i tabele) w formacie JSON."""
    tables = [
        "weddings",
        "users",
        "wedding_tables",
        "guests",
        "budget_items",
        "budget_installments",
        "checklist_tasks",
        "timeline_events",
        "vendors",
    ]
    dump: dict = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "exported_by": admin.email,
        "tables": {},
    }

    with get_db() as client:
        for tbl in tables:
            if tbl == "users":
                res = client.execute(
                    "SELECT id, email, is_approved, is_admin, wedding_id, role_label, created_at FROM users ORDER BY id ASC"
                )
            else:
                res = client.execute(f"SELECT * FROM {tbl} ORDER BY id ASC")
            dump["tables"][tbl] = rows_to_dicts(res.rows)

    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    raw_json = json.dumps(dump, ensure_ascii=False, indent=2, default=str).encode("utf-8")
    return StreamingResponse(
        io.BytesIO(raw_json),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="full_system_backup_{stamp}.json"'},
    )


@router.get("/metrics", response_model=AdminSystemMetricsResponse)
def get_system_metrics(admin: UserResponse = Depends(get_current_admin)):
    cpu = psutil.cpu_percent(interval=None)
    vm = psutil.virtual_memory()

    try:
        disk = psutil.disk_usage(os.path.abspath(os.sep))
    except Exception:
        disk = psutil.disk_usage("/")

    server_metrics = ServerMetrics(
        cpu_percent=float(cpu),
        ram_total_gb=round(vm.total / (1024**3), 2),
        ram_used_gb=round(vm.used / (1024**3), 2),
        ram_percent=float(vm.percent),
        disk_total_gb=round(disk.total / (1024**3), 2),
        disk_used_gb=round(disk.used / (1024**3), 2),
        disk_percent=float(disk.percent),
        process_uptime_seconds=round(time.time() - PROCESS_START_TIME, 1),
        python_version=f"{platform.python_implementation()} {sys.version.split()[0]} ({platform.system()} {platform.release()})",
    )

    tables = [
        "weddings",
        "users",
        "wedding_tables",
        "guests",
        "budget_items",
        "budget_installments",
        "checklist_tasks",
        "timeline_events",
        "vendors",
    ]
    table_stats = []
    total_rows = 0

    with get_db() as client:
        for tbl in tables:
            try:
                cnt_res = client.execute(f"SELECT COUNT(*) as count FROM {tbl}")
                count = row_to_dict(cnt_res.rows[0])["count"]
            except Exception:
                count = 0
            table_stats.append(TableStat(table_name=tbl, row_count=count))
            total_rows += count

        try:
            pc_res = client.execute("PRAGMA page_count;")
            ps_res = client.execute("PRAGMA page_size;")
            page_count = list(row_to_dict(pc_res.rows[0]).values())[0] or 0
            page_size = list(row_to_dict(ps_res.rows[0]).values())[0] or 4096
            total_bytes = page_count * page_size
        except Exception:
            total_bytes = total_rows * 512

    db_metrics = DatabaseMetrics(
        total_size_bytes=total_bytes,
        total_size_mb=round(total_bytes / (1024**2), 3),
        total_rows=total_rows,
        tables=table_stats,
    )

    return AdminSystemMetricsResponse(
        server=server_metrics,
        database=db_metrics,
    )