from contextlib import asynccontextmanager
from datetime import date, datetime
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import get_current_user
from database import get_db, init_db, row_to_dict, rows_to_dicts
from models import (
    DashboardStats,
    TimelineEventResponse,
    UpcomingInstallmentAlert,
    UserResponse,
    UserDarkModeUpdate
)
from routers import admin as admin_router
from routers import auth as auth_router
from routers import budget, checklist, guests, reports, tables, timeline, vendors, wedding_settings
from routers.wedding_settings import _get_or_create_wedding_id


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Wedding Planner API",
    version="2.1.0",
    description="Backend API do zarządzania organizacją wesela",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rejestracja wszystkich modułów routerów
app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(wedding_settings.router)
app.include_router(guests.router)
app.include_router(tables.router)
app.include_router(budget.router)
app.include_router(checklist.router)
app.include_router(timeline.router)
app.include_router(vendors.router)
app.include_router(reports.router)


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok", "service": "wedding-planner-backend", "version": "2.1.0"}

@app.patch("/auth/dark-mode")
def update_user_dark_mode(
    payload: UserDarkModeUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    val = 1 if payload.dark_mode else 0
    with get_db() as client:
        client.execute(
            "UPDATE users SET dark_mode = ? WHERE id = ?",
            [val, current_user.id],
        )
    return {"dark_mode": val}

@app.get("/dashboard/stats", response_model=DashboardStats, tags=["Dashboard"])
def get_dashboard_stats(current_user: UserResponse = Depends(get_current_user)):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)

        wed_res = client.execute("SELECT * FROM weddings WHERE id = ?", [wid])
        wed = row_to_dict(wed_res.rows[0]) if wed_res.rows else {}

        wedding_name = wed.get("wedding_name") or "Nasze Wesele"
        wedding_date = wed.get("wedding_date")
        adult_weight = float(wed.get("adult_weight") if wed.get("adult_weight") is not None else 1.0)
        child_weight = float(wed.get("child_weight") if wed.get("child_weight") is not None else 0.5)
        toddler_weight = float(wed.get("toddler_weight") if wed.get("toddler_weight") is not None else 0.0)
        plate_price = float(wed.get("plate_price") if wed.get("plate_price") is not None else 350.0)
        afterparty_price = float(wed.get("afterparty_price") if wed.get("afterparty_price") is not None else 120.0)
        hotel_price = float(wed.get("hotel_price") if wed.get("hotel_price") is not None else 150.0)

        guests_res = client.execute(
            """
            SELECT 
                COUNT(*) as total_physical,
                SUM(CASE WHEN age_category = 'adult' THEN ?
                         WHEN age_category = 'child' THEN ?
                         ELSE ? END) as weighted_count,
                SUM(CASE WHEN rsvp_status != 'declined' THEN
                        (CASE WHEN age_category = 'adult' THEN ?
                              WHEN age_category = 'child' THEN ?
                              ELSE ? END)
                    ELSE 0.0 END) as active_weighted_count,
                SUM(CASE WHEN rsvp_status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
                SUM(CASE WHEN rsvp_status = 'declined' THEN 1 ELSE 0 END) as declined,
                SUM(CASE WHEN rsvp_status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN needs_hotel = 1 AND rsvp_status != 'declined' THEN 1 ELSE 0 END) as hotel_guests,
                SUM(CASE WHEN needs_transport = 1 AND rsvp_status != 'declined' THEN 1 ELSE 0 END) as transport_guests,
                SUM(CASE WHEN table_id IS NOT NULL THEN 1 ELSE 0 END) as assigned_seats
            FROM guests
            WHERE wedding_id = ?
            """,
            [
                adult_weight,
                child_weight,
                toddler_weight,
                adult_weight,
                child_weight,
                toddler_weight,
                wid,
            ],
        )
        g_row = row_to_dict(guests_res.rows[0])

        total_physical_guests = g_row["total_physical"] or 0
        weighted_guest_count = float(g_row["weighted_count"] or 0.0)
        active_weighted_count = float(g_row["active_weighted_count"] or 0.0)
        confirmed_guests = g_row["confirmed"] or 0
        declined_guests = g_row["declined"] or 0
        pending_guests = g_row["pending"] or 0
        hotel_guests_count = g_row["hotel_guests"] or 0
        transport_guests_count = g_row["transport_guests"] or 0
        assigned_seats = g_row["assigned_seats"] or 0

        tables_res = client.execute(
            "SELECT COALESCE(SUM(capacity), 0) as total_capacity FROM wedding_tables WHERE wedding_id = ?",
            [wid],
        )
        total_capacity = row_to_dict(tables_res.rows[0])["total_capacity"] or 0

        budget_res = client.execute(
            """
            SELECT 
                COALESCE(SUM(estimated_cost), 0.0) as estimated,
                COALESCE(SUM(actual_cost), 0.0) as actual,
                COALESCE(SUM(CASE WHEN paid = 0 THEN (CASE WHEN actual_cost > 0 THEN actual_cost ELSE estimated_cost END) ELSE 0.0 END), 0.0) as remaining
            FROM budget_items
            WHERE wedding_id = ?
            """,
            [wid],
        )
        b_row = row_to_dict(budget_res.rows[0])
        estimated_budget = float(b_row["estimated"] or 0.0)
        actual_budget = float(b_row["actual"] or 0.0)
        remaining_to_pay = float(b_row["remaining"] or 0.0)

        catering_estimated_cost = round(active_weighted_count * plate_price, 2)
        afterparty_estimated_cost = round(active_weighted_count * afterparty_price, 2)
        hotel_estimated_cost = round(hotel_guests_count * hotel_price, 2)

        timeline_res = client.execute(
            """
            SELECT id, time_start, title, description, assigned_person
            FROM timeline_events
            WHERE wedding_id = ?
            ORDER BY time_start ASC
            LIMIT 3
            """,
            [wid],
        )
        timeline_rows = rows_to_dicts(timeline_res.rows)
        upcoming_timeline = [TimelineEventResponse(**row) for row in timeline_rows]

        # Alerty o nieopłaconych ratach (przeterminowanych lub w ciągu najbliższych 14 dni)
        inst_res = client.execute(
            """
            SELECT bi.id, bi.budget_item_id, bi.installment_name, bi.amount, bi.due_date,
                   b.item_name, b.category
            FROM budget_installments bi
            JOIN budget_items b ON bi.budget_item_id = b.id
            WHERE bi.wedding_id = ? AND bi.paid = 0 AND bi.due_date IS NOT NULL AND bi.due_date != ''
            ORDER BY bi.due_date ASC
            """,
            [wid],
        )
        today = date.today()
        upcoming_installments: list[UpcomingInstallmentAlert] = []
        for row in rows_to_dicts(inst_res.rows):
            try:
                due = datetime.strptime(row["due_date"][:10], "%Y-%m-%d").date()
                diff_days = (due - today).days
                if diff_days <= 14:
                    upcoming_installments.append(
                        UpcomingInstallmentAlert(
                            id=row["id"],
                            budget_item_id=row["budget_item_id"],
                            item_name=row["item_name"],
                            category=row["category"],
                            installment_name=row["installment_name"],
                            amount=float(row["amount"]),
                            due_date=row["due_date"][:10],
                            is_overdue=diff_days < 0,
                            days_remaining=diff_days,
                        )
                    )
            except Exception:
                continue

        return DashboardStats(
            wedding_name=wedding_name,
            wedding_date=wedding_date,
            total_physical_guests=total_physical_guests,
            weighted_guest_count=weighted_guest_count,
            confirmed_guests=confirmed_guests,
            declined_guests=declined_guests,
            pending_guests=pending_guests,
            hotel_guests_count=hotel_guests_count,
            transport_guests_count=transport_guests_count,
            assigned_seats=assigned_seats,
            total_capacity=total_capacity,
            estimated_budget=estimated_budget,
            actual_budget=actual_budget,
            remaining_to_pay=remaining_to_pay,
            catering_estimated_cost=catering_estimated_cost,
            afterparty_estimated_cost=afterparty_estimated_cost,
            hotel_estimated_cost=hotel_estimated_cost,
            plate_price=plate_price,
            afterparty_price=afterparty_price,
            hotel_price=hotel_price,
            adult_weight=adult_weight,
            child_weight=child_weight,
            toddler_weight=toddler_weight,
            upcoming_timeline=upcoming_timeline,
            upcoming_installments=upcoming_installments,
        )