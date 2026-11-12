import os
from contextlib import contextmanager
from typing import Any, Dict, List
from dotenv import load_dotenv
import libsql_client

load_dotenv()

TURSO_DATABASE_URL = os.getenv("TURSO_DATABASE_URL")
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN")

if not TURSO_DATABASE_URL:
    raise ValueError("Brak zmiennej środowiskowej TURSO_DATABASE_URL w pliku .env")


def get_client() -> libsql_client.Client:
    return libsql_client.create_client_sync(
        url=TURSO_DATABASE_URL,
        auth_token=TURSO_AUTH_TOKEN,
    )


@contextmanager
def get_db():
    client = get_client()
    try:
        yield client
    finally:
        client.close()


def row_to_dict(row: Any) -> Dict[str, Any]:
    if hasattr(row, "as_dict"):
        return dict(row.as_dict())
    if hasattr(row, "_column_idxs"):
        return {column: row[column] for column in row._column_idxs}
    if hasattr(row, "keys"):
        return {k: row[k] for k in row.keys()}
    try:
        return dict(row)
    except Exception:
        return {}


def rows_to_dicts(rows: List[Any]) -> List[Dict[str, Any]]:
    return [row_to_dict(r) for r in rows]


def _ensure_column(client: libsql_client.Client, table_name: str, column_name: str, column_def: str) -> None:
    info_res = client.execute(f"PRAGMA table_info({table_name})")
    existing_cols = [row_to_dict(r)["name"] for r in info_res.rows]
    if column_name not in existing_cols:
        client.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def}")


def init_db() -> None:
    ddl_statements = [
        """
        CREATE TABLE IF NOT EXISTS weddings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wedding_name TEXT NOT NULL DEFAULT 'Nasze Wesele',
            wedding_date TEXT,
            venue_name TEXT,
            adult_weight REAL DEFAULT 1.0,
            child_weight REAL DEFAULT 0.5,
            toddler_weight REAL DEFAULT 0.0,
            adult_age_desc TEXT DEFAULT 'powyżej 10 lat',
            child_age_desc TEXT DEFAULT '3–10 lat',
            toddler_age_desc TEXT DEFAULT '0–2 lata',
            plate_price REAL DEFAULT 350.0,
            afterparty_price REAL DEFAULT 120.0,
            hotel_price REAL DEFAULT 150.0,
            theme_color TEXT DEFAULT 'emerald',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_approved INTEGER DEFAULT 0,
            is_admin INTEGER DEFAULT 0,
            wedding_id INTEGER REFERENCES weddings(id) ON DELETE SET NULL,
            role_label TEXT DEFAULT 'Para Młoda',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS wedding_tables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wedding_id INTEGER REFERENCES weddings(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            capacity INTEGER NOT NULL,
            shape TEXT NOT NULL DEFAULT 'round'
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS guests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wedding_id INTEGER REFERENCES weddings(id) ON DELETE CASCADE,
            table_id INTEGER REFERENCES wedding_tables(id) ON DELETE SET NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            age_category TEXT DEFAULT 'adult',
            rsvp_status TEXT DEFAULT 'pending',
            diet TEXT DEFAULT 'standard',
            needs_hotel INTEGER DEFAULT 0,
            room_number TEXT,
            nights_count INTEGER DEFAULT 1,
            accommodation_payer TEXT DEFAULT 'couple',
            invitation_salutation TEXT,
            needs_transport INTEGER DEFAULT 0,
            transport_pickup TEXT,
            transport_return_time TEXT,
            seating_notes TEXT,
            rsvp_group_id TEXT,
            rsvp_token TEXT UNIQUE,
            invite_sent INTEGER DEFAULT 0
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS budget_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wedding_id INTEGER REFERENCES weddings(id) ON DELETE CASCADE,
            category TEXT NOT NULL,
            item_name TEXT NOT NULL,
            estimated_cost REAL DEFAULT 0.0,
            actual_cost REAL DEFAULT 0.0,
            paid INTEGER DEFAULT 0
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS budget_installments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wedding_id INTEGER REFERENCES weddings(id) ON DELETE CASCADE,
            budget_item_id INTEGER REFERENCES budget_items(id) ON DELETE CASCADE,
            installment_name TEXT NOT NULL,
            amount REAL NOT NULL DEFAULT 0.0,
            due_date TEXT,
            paid INTEGER DEFAULT 0,
            notes TEXT
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS checklist_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wedding_id INTEGER REFERENCES weddings(id) ON DELETE CASCADE,
            stage TEXT NOT NULL DEFAULT '6+ miesięcy przed',
            title TEXT NOT NULL,
            description TEXT,
            assigned_to TEXT DEFAULT 'Para Młoda',
            due_date TEXT,
            is_completed INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS timeline_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wedding_id INTEGER REFERENCES weddings(id) ON DELETE CASCADE,
            time_start TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            assigned_person TEXT
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS vendors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wedding_id INTEGER REFERENCES weddings(id) ON DELETE CASCADE,
            category TEXT NOT NULL,
            name TEXT NOT NULL,
            contact_phone TEXT,
            price REAL DEFAULT 0.0,
            contract_signed INTEGER DEFAULT 0
        );
        """
    ]

    with get_db() as client:
        for stmt in ddl_statements:
            client.execute(stmt)

        # Migracje Fazy 1
        _ensure_column(client, "users", "is_approved", "INTEGER DEFAULT 0")
        _ensure_column(client, "users", "is_admin", "INTEGER DEFAULT 0")
        _ensure_column(client, "users", "wedding_id", "INTEGER REFERENCES weddings(id) ON DELETE SET NULL")
        _ensure_column(client, "users", "role_label", "TEXT DEFAULT 'Para Młoda'")

        for tbl in ["wedding_tables", "guests", "budget_items", "timeline_events", "vendors"]:
            _ensure_column(client, tbl, "wedding_id", "INTEGER REFERENCES weddings(id) ON DELETE CASCADE")

        # Migracje Fazy 2 dla tabeli guests
        _ensure_column(client, "guests", "room_number", "TEXT")
        _ensure_column(client, "guests", "nights_count", "INTEGER DEFAULT 1")
        _ensure_column(client, "guests", "accommodation_payer", "TEXT DEFAULT 'couple'")
        _ensure_column(client, "guests", "invitation_salutation", "TEXT")
        _ensure_column(client, "guests", "needs_transport", "INTEGER DEFAULT 0")
        _ensure_column(client, "guests", "transport_pickup", "TEXT")
        _ensure_column(client, "guests", "transport_return_time", "TEXT")
        _ensure_column(client, "guests", "seating_notes", "TEXT")

        # Zapewnienie domyślnego rekordu wesela
        wed_res = client.execute("SELECT id FROM weddings ORDER BY id ASC LIMIT 1")
        if not wed_res.rows:
            ins_res = client.execute(
                "INSERT INTO weddings (wedding_name) VALUES ('Nasze Wesele') RETURNING id"
            )
            default_wedding_id = row_to_dict(ins_res.rows[0])["id"]
        else:
            default_wedding_id = row_to_dict(wed_res.rows[0])["id"]

        client.execute("UPDATE users SET wedding_id = ? WHERE wedding_id IS NULL", [default_wedding_id])
        for tbl in ["wedding_tables", "guests", "budget_items", "timeline_events", "vendors"]:
            client.execute(f"UPDATE {tbl} SET wedding_id = ? WHERE wedding_id IS NULL", [default_wedding_id])


if __name__ == "__main__":
    init_db()
    print("Inicjalizacja i migracja schematu Fazy 2 powiodła się.")