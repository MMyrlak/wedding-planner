import csv
import io
import os
import re
import secrets
import zipfile
from collections import defaultdict
from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
import openpyxl
from openpyxl.styles import Font, PatternFill
import qrcode
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from auth import get_current_user
from database import get_db, row_to_dict, rows_to_dicts
from models import (
    CateringReportSummary,
    HotelGuestRow,
    HotelReportSummary,
    InvitationPreviewItem,
    PlaceCardPreviewItem,
    TableCateringBreakdown,
    TransportPassengerRow,
    TransportReportSummary,
    UserResponse,
)
from routers.wedding_settings import _get_or_create_wedding_id

router = APIRouter(prefix="/reports", tags=["Reports & Generators"])


def _register_polish_pdf_fonts() -> tuple[str, str]:
    font_candidates = [
        ("CustomSans", "C:/Windows/Fonts/arial.ttf", "CustomSans-Bold", "C:/Windows/Fonts/arialbd.ttf"),
        ("CustomSans", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "CustomSans-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        ("CustomSans", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "CustomSans-Bold", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
    ]
    for reg_name, reg_path, bold_name, bold_path in font_candidates:
        if os.path.exists(reg_path):
            try:
                if reg_name not in pdfmetrics.getRegisteredFontNames():
                    pdfmetrics.registerFont(TTFont(reg_name, reg_path))
                if os.path.exists(bold_path) and bold_name not in pdfmetrics.getRegisteredFontNames():
                    pdfmetrics.registerFont(TTFont(bold_name, bold_path))
                    return reg_name, bold_name
                return reg_name, reg_name
            except Exception:
                continue
    return "Helvetica", "Helvetica-Bold"


def _is_anonymous_companion(first_name: str, last_name: str) -> bool:
    combined = f"{first_name} {last_name}".strip().lower()
    fn = first_name.strip().lower()
    ln = last_name.strip().lower()

    if any(
        phrase in combined
        for phrase in [
            "osoba towarzysząca",
            "osoba towarzyszaca",
            "os. towarzysząca",
            "os. towarzyszaca",
            "osoba tow.",
            "os. tow.",
        ]
    ):
        return True

    if fn in {"osoba", "os.", "brak", "?", "-", "gość", "gosc"} and ("towarzysz" in ln or ln in {"", "?", "-"}):
        return True

    return False


def _format_invitation_salutation(members: List[Dict[str, Any]]) -> str:
    for m in members:
        custom = (m.get("invitation_salutation") or "").strip()
        if custom:
            return custom

    adults = [m for m in members if m.get("age_category") == "adult"]
    children = [m for m in members if m.get("age_category") in ("child", "toddler")]

    named_adults = [m for m in adults if not _is_anonymous_companion(m.get("first_name", ""), m.get("last_name", ""))]
    has_companion = len(adults) > len(named_adults)

    children_suffix = ""
    if len(children) == 1:
        children_suffix = " z dzieckiem"
    elif len(children) > 1:
        children_suffix = " z dziećmi"

    if len(named_adults) >= 2:
        a1, a2 = named_adults[0], named_adults[1]
        fn1, ln1 = a1["first_name"].strip(), a1["last_name"].strip()
        fn2, ln2 = a2["first_name"].strip(), a2["last_name"].strip()

        if ln1.lower() == ln2.lower():
            base = f"Sz.P. {fn1} i {fn2} {ln1}"
        else:
            base = f"Sz.P. {fn1} {ln1} i {fn2} {ln2}"

        if len(named_adults) > 2:
            base += " z Rodziną"
        return f"{base}{children_suffix}"

    if len(named_adults) == 1:
        a1 = named_adults[0]
        fn1, ln1 = a1["first_name"].strip(), a1["last_name"].strip()
        comp_suffix = " z Osobą Towarzyszącą" if has_companion else ""
        return f"Sz.P. {fn1} {ln1}{comp_suffix}{children_suffix}"

    first = members[0]
    return f"Sz.P. Rodzina {first.get('last_name', '').strip()}"


def _sanitize_filename(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "_", value.strip())
    return cleaned.strip("_") or "zaproszenie"


# ==========================================
# MODUŁ 1A: RAPORT CATERINGOWY DLA KUCHNI
# ==========================================

def _build_catering_data(client, wid: int) -> CateringReportSummary:
    wed_res = client.execute("SELECT * FROM weddings WHERE id = ?", [wid])
    wed = row_to_dict(wed_res.rows[0]) if wed_res.rows else {}

    wedding_name = wed.get("wedding_name") or "Nasze Wesele"
    w_adult = float(wed.get("adult_weight") if wed.get("adult_weight") is not None else 1.0)
    w_child = float(wed.get("child_weight") if wed.get("child_weight") is not None else 0.5)
    w_toddler = float(wed.get("toddler_weight") if wed.get("toddler_weight") is not None else 0.0)

    tables_res = client.execute(
        "SELECT id, name FROM wedding_tables WHERE wedding_id = ? ORDER BY id ASC",
        [wid],
    )
    tables_list = rows_to_dicts(tables_res.rows)
    table_names = {t["id"]: t["name"] for t in tables_list}

    guests_res = client.execute(
        """
        SELECT id, table_id, first_name, last_name, age_category, rsvp_status, diet
        FROM guests
        WHERE wedding_id = ? AND rsvp_status != 'declined'
        ORDER BY table_id ASC, last_name ASC
        """,
        [wid],
    )
    active_guests = rows_to_dicts(guests_res.rows)

    age_breakdown = {"adult": 0, "child": 0, "toddler": 0}
    diet_totals: Dict[str, int] = defaultdict(int)
    total_weighted = 0.0

    per_table: Dict[Optional[int], Dict[str, Any]] = {}
    for t in tables_list:
        per_table[t["id"]] = {
            "table_id": t["id"],
            "table_name": t["name"],
            "physical_guests": 0,
            "weighted_plates": 0.0,
            "diets": defaultdict(int),
        }

    for g in active_guests:
        age = g.get("age_category") or "adult"
        age_breakdown[age] = age_breakdown.get(age, 0) + 1

        weight = w_adult if age == "adult" else (w_child if age == "child" else w_toddler)
        total_weighted += weight

        diet_label = (g.get("diet") or "standard").strip().lower()
        diet_totals[diet_label] += 1

        tid = g.get("table_id")
        if tid not in per_table:
            per_table[tid] = {
                "table_id": tid,
                "table_name": table_names.get(tid, "Nieprzypisani do stołu"),
                "physical_guests": 0,
                "weighted_plates": 0.0,
                "diets": defaultdict(int),
            }

        per_table[tid]["physical_guests"] += 1
        per_table[tid]["weighted_plates"] = round(per_table[tid]["weighted_plates"] + weight, 2)
        per_table[tid]["diets"][diet_label] += 1

    tables_breakdown = [
        TableCateringBreakdown(
            table_id=entry["table_id"],
            table_name=entry["table_name"],
            physical_guests=entry["physical_guests"],
            weighted_plates=round(entry["weighted_plates"], 2),
            diets=dict(entry["diets"]),
        )
        for entry in per_table.values()
        if entry["physical_guests"] > 0 or entry["table_id"] is not None
    ]

    return CateringReportSummary(
        wedding_name=wedding_name,
        total_active_guests=len(active_guests),
        total_weighted_plates=round(total_weighted, 2),
        age_breakdown=age_breakdown,
        diet_totals=dict(diet_totals),
        tables_breakdown=tables_breakdown,
    )


@router.get("/catering/summary", response_model=CateringReportSummary)
def get_catering_summary(current_user: UserResponse = Depends(get_current_user)):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        return _build_catering_data(client, wid)


@router.get("/catering/export")
def export_catering_report(
    format: Literal["pdf", "xlsx", "csv"] = Query("pdf"),
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        summary = _build_catering_data(client, wid)

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerow(["Stół", "Liczba osób", "Talerzyki przeliczeniowe", "Rozkład diet"])
        for t in summary.tables_breakdown:
            diets_str = ", ".join([f"{k}: {v}" for k, v in t.diets.items()]) or "brak gości"
            writer.writerow([t.table_name, t.physical_guests, t.weighted_plates, diets_str])
        writer.writerow([])
        writer.writerow(["PODSUMOWANIE GLOBALNE", summary.total_active_guests, summary.total_weighted_plates, ""])
        for d_name, d_cnt in summary.diet_totals.items():
            writer.writerow(["Dieta", d_name, d_cnt, ""])

        bom_bytes = ("\ufeff" + output.getvalue()).encode("utf-8")
        return StreamingResponse(
            io.BytesIO(bom_bytes),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="raport_cateringowy_kuchnia.csv"'},
        )

    if format == "xlsx":
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Raport Kuchnia"

        header_fill = PatternFill(start_color="059669", end_color="059669", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)

        ws.append([f"Raport Cateringowy – {summary.wedding_name}"])
        ws["A1"].font = Font(size=14, bold=True)
        ws.append([
            "Łącznie osób aktywnych:", summary.total_active_guests,
            "Talerzyki przeliczeniowe:", summary.total_weighted_plates
        ])
        ws.append([
            f"Dorośli: {summary.age_breakdown.get('adult', 0)}",
            f"Dzieci: {summary.age_breakdown.get('child', 0)}",
            f"Maluchy: {summary.age_breakdown.get('toddler', 0)}",
        ])
        ws.append([])

        ws.append(["ZESTAWIENIE DIET (GLOBALNIE)"])
        ws["A5"].font = Font(bold=True)
        ws.append(["Rodzaj diety", "Liczba porcji"])
        for cell in ws[6]:
            cell.fill = header_fill
            cell.font = header_font
        for d_name, d_cnt in summary.diet_totals.items():
            ws.append([d_name.capitalize(), d_cnt])

        ws.append([])
        start_tbl_row = ws.max_row + 1
        ws.append(["ROZKŁAD NA STOŁY"])
        ws[f"A{start_tbl_row}"].font = Font(bold=True)
        ws.append(["Nazwa / Numer stołu", "Osoby fizyczne", "Talerzyki przeliczeniowe", "Szczegóły diet przy stole"])
        for cell in ws[start_tbl_row + 1]:
            cell.fill = header_fill
            cell.font = header_font

        for t in summary.tables_breakdown:
            diets_str = ", ".join([f"{v}x {k}" for k, v in t.diets.items()]) or "Brak przypisanych gości"
            ws.append([t.table_name, t.physical_guests, t.weighted_plates, diets_str])

        stream = io.BytesIO()
        wb.save(stream)
        stream.seek(0)
        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="raport_cateringowy_kuchnia.xlsx"'},
        )

    reg_font, bold_font = _register_polish_pdf_fonts()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=15 * mm, bottomMargin=15 * mm)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("TitlePL", parent=styles["Heading1"], fontName=bold_font, fontSize=16, spaceAfter=6)
    sub_style = ParagraphStyle("SubPL", parent=styles["Normal"], fontName=reg_font, fontSize=10, textColor=colors.HexColor("#475569"), spaceAfter=12)
    h2_style = ParagraphStyle("H2PL", parent=styles["Heading2"], fontName=bold_font, fontSize=12, spaceBefore=10, spaceAfter=6)

    elements = [
        Paragraph(f"Raport Cateringowy dla Kuchni – {summary.wedding_name}", title_style),
        Paragraph(
            f"Osoby aktywne: <b>{summary.total_active_guests}</b> | "
            f"Talerzyki przeliczeniowe: <b>{summary.total_weighted_plates}</b> | "
            f"Dorośli: {summary.age_breakdown.get('adult', 0)}, Dzieci: {summary.age_breakdown.get('child', 0)}, Maluchy: {summary.age_breakdown.get('toddler', 0)}",
            sub_style,
        ),
        Paragraph("1. Zestawienie zbiorcze diet", h2_style),
    ]

    diet_data = [["Rodzaj diety", "Liczba porcji"]]
    for d_name, d_cnt in summary.diet_totals.items():
        diet_data.append([d_name.capitalize(), str(d_cnt)])

    diet_table = Table(diet_data, colWidths=[110 * mm, 60 * mm], hAlign="LEFT")
    diet_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#059669")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), bold_font),
            ("FONTNAME", (0, 1), (-1, -1), reg_font),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("PADDING", (0, 0), (-1, -1), 6),
        ])
    )
    elements.append(diet_table)
    elements.append(Spacer(1, 8 * mm))
    elements.append(Paragraph("2. Rozkład diet i talerzyków według stołów", h2_style))

    tbl_data = [["Stół", "Osoby", "Talerzyki", "Diety przy stole"]]
    for t in summary.tables_breakdown:
        diets_str = ", ".join([f"{v}x {k}" for k, v in t.diets.items()]) or "Brak gości"
        tbl_data.append([t.table_name, str(t.physical_guests), str(t.weighted_plates), diets_str])

    main_table = Table(tbl_data, colWidths=[45 * mm, 22 * mm, 25 * mm, 88 * mm], hAlign="LEFT")
    main_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), bold_font),
            ("FONTNAME", (0, 1), (-1, -1), reg_font),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("PADDING", (0, 0), (-1, -1), 6),
        ])
    )
    elements.append(main_table)

    doc.build(elements)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="raport_cateringowy_kuchnia.pdf"'},
    )


# ==========================================
# MODUŁ 1B: LISTA HOTELOWA DLA RECEPCJI
# ==========================================

def _build_hotel_data(client, wid: int) -> HotelReportSummary:
    wed_res = client.execute("SELECT wedding_name, hotel_price FROM weddings WHERE id = ?", [wid])
    wed = row_to_dict(wed_res.rows[0]) if wed_res.rows else {}
    wedding_name = wed.get("wedding_name") or "Nasze Wesele"
    hotel_price = float(wed.get("hotel_price") if wed.get("hotel_price") is not None else 150.0)

    guests_res = client.execute(
        """
        SELECT id, first_name, last_name, age_category, rsvp_status, rsvp_group_id,
               room_number, nights_count, accommodation_payer
        FROM guests
        WHERE wedding_id = ? AND needs_hotel = 1 AND rsvp_status != 'declined'
        ORDER BY COALESCE(room_number, 'ZZZ') ASC, rsvp_group_id ASC, last_name ASC
        """,
        [wid],
    )
    hotel_guests = rows_to_dicts(guests_res.rows)

    rows: List[HotelGuestRow] = []
    total_nights = 0
    couple_cost = 0.0
    guest_cost = 0.0

    for g in hotel_guests:
        nights = int(g.get("nights_count") or 1)
        payer = g.get("accommodation_payer") or "couple"
        cost = round(nights * hotel_price, 2)

        total_nights += nights
        if payer == "guest":
            guest_cost += cost
        else:
            couple_cost += cost

        rows.append(
            HotelGuestRow(
                guest_id=g["id"],
                full_name=f"{g['first_name']} {g['last_name']}",
                age_category=g.get("age_category") or "adult",
                rsvp_status=g.get("rsvp_status") or "pending",
                rsvp_group_id=g.get("rsvp_group_id"),
                room_number=(g.get("room_number") or "Nieprzydzielony").strip(),
                nights_count=nights,
                accommodation_payer=payer,
                estimated_cost=cost,
            )
        )

    return HotelReportSummary(
        wedding_name=wedding_name,
        hotel_price_per_night=hotel_price,
        total_hotel_guests=len(rows),
        total_person_nights=total_nights,
        couple_covered_cost=round(couple_cost, 2),
        guest_covered_cost=round(guest_cost, 2),
        rows=rows,
    )


@router.get("/hotel/summary", response_model=HotelReportSummary)
def get_hotel_summary(current_user: UserResponse = Depends(get_current_user)):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        return _build_hotel_data(client, wid)


@router.get("/hotel/export")
def export_hotel_report(
    format: Literal["pdf", "xlsx", "csv"] = Query("pdf"),
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        summary = _build_hotel_data(client, wid)

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerow(["Pokój", "Gość", "Kategoria", "Status RSVP", "Liczba dób", "Płatnik", "Kwota (PLN)"])
        for r in summary.rows:
            payer_pl = "Para Młoda" if r.accommodation_payer == "couple" else "Gość indywidualnie"
            writer.writerow([r.room_number, r.full_name, r.age_category, r.rsvp_status, r.nights_count, payer_pl, r.estimated_cost])
        bom_bytes = ("\ufeff" + output.getvalue()).encode("utf-8")
        return StreamingResponse(
            io.BytesIO(bom_bytes),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="lista_hotelowa_recepcja.csv"'},
        )

    if format == "xlsx":
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Lista Hotelowa"

        header_fill = PatternFill(start_color="059669", end_color="059669", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)

        ws.append([f"Lista Hotelowa dla Recepcji – {summary.wedding_name}"])
        ws["A1"].font = Font(size=14, bold=True)
        ws.append([
            f"Goście hotelowi: {summary.total_hotel_guests}",
            f"Osobodoby: {summary.total_person_nights}",
            f"Koszt Pary Młodej: {summary.couple_covered_cost} PLN",
            f"Koszt Gości: {summary.guest_covered_cost} PLN",
        ])
        ws.append([])

        ws.append(["Pokój", "Imię i Nazwisko", "Kategoria", "Status RSVP", "Liczba dób", "Płatnik noclegu", "Koszt (PLN)"])
        for cell in ws[4]:
            cell.fill = header_fill
            cell.font = header_font

        for r in summary.rows:
            payer_pl = "Para Młoda" if r.accommodation_payer == "couple" else "Gość"
            ws.append([r.room_number, r.full_name, r.age_category, r.rsvp_status, r.nights_count, payer_pl, r.estimated_cost])

        stream = io.BytesIO()
        wb.save(stream)
        stream.seek(0)
        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="lista_hotelowa_recepcja.xlsx"'},
        )

    reg_font, bold_font = _register_polish_pdf_fonts()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=15 * mm, bottomMargin=15 * mm)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("TitlePL", parent=styles["Heading1"], fontName=bold_font, fontSize=16, spaceAfter=6)
    sub_style = ParagraphStyle("SubPL", parent=styles["Normal"], fontName=reg_font, fontSize=9.5, textColor=colors.HexColor("#475569"), spaceAfter=12)

    elements = [
        Paragraph(f"Lista Hotelowa dla Recepcji – {summary.wedding_name}", title_style),
        Paragraph(
            f"Liczba gości: <b>{summary.total_hotel_guests}</b> | Osobodoby: <b>{summary.total_person_nights}</b> | "
            f"Rozliczenie Para Młoda: <b>{summary.couple_covered_cost:.0f} PLN</b> | Goście: <b>{summary.guest_covered_cost:.0f} PLN</b>",
            sub_style,
        ),
    ]

    tbl_data = [["Pokój", "Imię i Nazwisko", "Status", "Doby", "Płatnik", "Kwota"]]
    for r in summary.rows:
        payer_pl = "Para Młoda" if r.accommodation_payer == "couple" else "Gość"
        status_pl = "Potw." if r.rsvp_status == "confirmed" else "Oczek."
        tbl_data.append([
            r.room_number,
            r.full_name,
            status_pl,
            str(r.nights_count),
            payer_pl,
            f"{r.estimated_cost:.0f} PLN",
        ])

    hotel_table = Table(tbl_data, colWidths=[32 * mm, 56 * mm, 20 * mm, 16 * mm, 28 * mm, 28 * mm], hAlign="LEFT")
    hotel_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#059669")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), bold_font),
            ("FONTNAME", (0, 1), (-1, -1), reg_font),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("PADDING", (0, 0), (-1, -1), 5),
        ])
    )
    elements.append(hotel_table)

    doc.build(elements)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="lista_hotelowa_recepcja.pdf"'},
    )


# ==========================================
# MODUŁ 2A: GENERATOR ZAPROSZEŃ I KODÓW QR
# ==========================================

def _build_invitations_list(client, wid: int, base_url: str) -> List[InvitationPreviewItem]:
    clean_base = base_url.rstrip("/")
    guests_res = client.execute(
        """
        SELECT id, first_name, last_name, age_category, invitation_salutation,
               rsvp_group_id, rsvp_token, invite_sent
        FROM guests
        WHERE wedding_id = ?
        ORDER BY COALESCE(rsvp_group_id, CAST(id AS TEXT)) ASC, id ASC
        """,
        [wid],
    )
    all_guests = rows_to_dicts(guests_res.rows)

    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for g in all_guests:
        gid = g.get("rsvp_group_id") or f"single-{g['id']}"
        grouped[gid].append(g)

    result: List[InvitationPreviewItem] = []
    for idx, (gid, members) in enumerate(grouped.items(), start=1):
        token = next((m["rsvp_token"] for m in members if m.get("rsvp_token")), None)
        if not token:
            token = secrets.token_urlsafe(10)
            for m in members:
                client.execute(
                    "UPDATE guests SET rsvp_token = ?, rsvp_group_id = ? WHERE id = ?",
                    [token, gid, m["id"]],
                )

        salutation = _format_invitation_salutation(members)
        members_names = [f"{m['first_name']} {m['last_name']}" for m in members]
        rsvp_url = f"{clean_base}/rsvp/{token}"
        safe_slug = _sanitize_filename(salutation[:35])
        qr_filename = f"{idx:03d}_{safe_slug}_{token[:6]}.png"
        invite_sent = 1 if all(m.get("invite_sent") == 1 for m in members) else 0

        result.append(
            InvitationPreviewItem(
                rsvp_group_id=gid,
                guest_ids=[m["id"] for m in members],
                salutation=salutation,
                members_names=members_names,
                members_count=len(members),
                rsvp_token=token,
                rsvp_url=rsvp_url,
                qr_filename=qr_filename,
                invite_sent=invite_sent,
            )
        )

    return result


@router.get("/invitations/preview", response_model=List[InvitationPreviewItem])
def get_invitations_preview(
    base_url: str = Query("http://localhost:5173"),
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        return _build_invitations_list(client, wid, base_url)


@router.get("/invitations/export")
def export_invitations_for_print(
    format: Literal["xlsx", "csv"] = Query("xlsx"),
    base_url: str = Query("http://localhost:5173"),
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        items = _build_invitations_list(client, wid, base_url)

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerow(["Lp.", "Treść na zaproszenie / kopertę", "Osoby w grupie", "Liczba osób", "Token RSVP", "Link RSVP", "Plik kodu QR"])
        for i, item in enumerate(items, start=1):
            writer.writerow([
                i,
                item.salutation,
                ", ".join(item.members_names),
                item.members_count,
                item.rsvp_token,
                item.rsvp_url,
                item.qr_filename,
            ])
        bom_bytes = ("\ufeff" + output.getvalue()).encode("utf-8")
        return StreamingResponse(
            io.BytesIO(bom_bytes),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="zaproszenia_do_druku.csv"'},
        )

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Zaproszenia do druku"

    header_fill = PatternFill(start_color="059669", end_color="059669", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)

    ws.append(["Lp.", "Treść na zaproszenie / kopertę", "Osoby w grupie", "Liczba osób", "Token RSVP", "Pełny link RSVP", "Plik kodu QR"])
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font

    for i, item in enumerate(items, start=1):
        ws.append([
            i,
            item.salutation,
            ", ".join(item.members_names),
            item.members_count,
            item.rsvp_token,
            item.rsvp_url,
            item.qr_filename,
        ])

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="zaproszenia_do_druku.xlsx"'},
    )


@router.get("/invitations/qr-zip")
def download_invitations_qr_zip(
    base_url: str = Query("http://localhost:5173"),
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        items = _build_invitations_list(client, wid, base_url)

    zip_buffer = io.BytesIO()
    csv_output = io.StringIO()
    csv_writer = csv.writer(csv_output, delimiter=";")
    csv_writer.writerow(["Nazwa pliku PNG", "Treść zaproszenia", "Osoby w grupie", "Token RSVP", "Docelowy URL"])

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for item in items:
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=12,
                border=2,
            )
            qr.add_data(item.rsvp_url)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")

            img_bytes = io.BytesIO()
            img.save(img_bytes, format="PNG")
            img_bytes.seek(0)

            zf.writestr(f"kody_qr/{item.qr_filename}", img_bytes.getvalue())
            csv_writer.writerow([
                item.qr_filename,
                item.salutation,
                ", ".join(item.members_names),
                item.rsvp_token,
                item.rsvp_url,
            ])

        zf.writestr("mapa_kodow_qr.csv", ("\ufeff" + csv_output.getvalue()).encode("utf-8"))

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="kody_qr_zaproszenia.zip"'},
    )


# ==========================================
# MODUŁ 2B: EKSPORT LISTY POD WINIETKI
# ==========================================

def _build_place_cards_list(client, wid: int) -> List[PlaceCardPreviewItem]:
    wed_res = client.execute("SELECT toddler_weight FROM weddings WHERE id = ?", [wid])
    wed = row_to_dict(wed_res.rows[0]) if wed_res.rows else {}
    toddler_weight = float(wed.get("toddler_weight") if wed.get("toddler_weight") is not None else 0.0)

    res = client.execute(
        """
        SELECT g.id, g.first_name, g.last_name, g.age_category, g.diet,
               t.name as table_name
        FROM guests g
        LEFT JOIN wedding_tables t ON g.table_id = t.id
        WHERE g.wedding_id = ? AND g.rsvp_status = 'confirmed'
        ORDER BY COALESCE(t.name, 'ZZZ') ASC, g.last_name ASC, g.first_name ASC
        """,
        [wid],
    )
    confirmed_guests = rows_to_dicts(res.rows)

    cards: List[PlaceCardPreviewItem] = []
    for g in confirmed_guests:
        age = g.get("age_category") or "adult"
        if age == "toddler" and toddler_weight == 0.0:
            continue

        fn = (g.get("first_name") or "").strip()
        ln = (g.get("last_name") or "").strip()

        if _is_anonymous_companion(fn, ln):
            continue

        cards.append(
            PlaceCardPreviewItem(
                guest_id=g["id"],
                display_name=f"{fn} {ln}",
                first_name=fn,
                last_name=ln,
                table_name=g.get("table_name") or "Brak przypisanego stołu",
                age_category=age,
                diet=g.get("diet") or "standard",
            )
        )

    return cards


@router.get("/place-cards/preview", response_model=List[PlaceCardPreviewItem])
def get_place_cards_preview(current_user: UserResponse = Depends(get_current_user)):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        return _build_place_cards_list(client, wid)


@router.get("/place-cards/export")
def export_place_cards(
    format: Literal["xlsx", "csv"] = Query("xlsx"),
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        cards = _build_place_cards_list(client, wid)

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerow(["Lp.", "Tekst na winietkę", "Imię", "Nazwisko", "Stół", "Kategoria", "Dieta"])
        for i, c in enumerate(cards, start=1):
            writer.writerow([i, c.display_name, c.first_name, c.last_name, c.table_name, c.age_category, c.diet])

        bom_bytes = ("\ufeff" + output.getvalue()).encode("utf-8")
        return StreamingResponse(
            io.BytesIO(bom_bytes),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="winietki_do_druku.csv"'},
        )

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Winietki"

    header_fill = PatternFill(start_color="059669", end_color="059669", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)

    ws.append(["Lp.", "Tekst na winietkę", "Imię", "Nazwisko", "Stół", "Kategoria wiekowa", "Dieta"])
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font

    for i, c in enumerate(cards, start=1):
        ws.append([i, c.display_name, c.first_name, c.last_name, c.table_name, c.age_category, c.diet])

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="winietki_do_druku.xlsx"'},
    )


# ==========================================
# MODUŁ 3: LOGISTYKA TRANSPORTU (BUS / TRANSFERY)
# ==========================================

def _build_transport_data(client, wid: int) -> TransportReportSummary:
    wed_res = client.execute("SELECT wedding_name FROM weddings WHERE id = ?", [wid])
    wed = row_to_dict(wed_res.rows[0]) if wed_res.rows else {}
    wedding_name = wed.get("wedding_name") or "Nasze Wesele"

    res = client.execute(
        """
        SELECT g.id, g.first_name, g.last_name, g.age_category, g.rsvp_status,
               g.transport_pickup, g.transport_return_time,
               t.name as table_name
        FROM guests g
        LEFT JOIN wedding_tables t ON g.table_id = t.id
        WHERE g.wedding_id = ? AND g.needs_transport = 1 AND g.rsvp_status != 'declined'
        ORDER BY COALESCE(g.transport_pickup, 'ZZZ') ASC,
                 COALESCE(g.transport_return_time, 'ZZZ') ASC,
                 g.last_name ASC
        """,
        [wid],
    )
    rows_raw = rows_to_dicts(res.rows)

    pickup_counts: Dict[str, int] = defaultdict(int)
    return_time_counts: Dict[str, int] = defaultdict(int)
    passengers: List[TransportPassengerRow] = []

    for g in rows_raw:
        pickup = (g.get("transport_pickup") or "Nieokreślony przystanek").strip()
        ret_time = (g.get("transport_return_time") or "Do ustalenia").strip()

        pickup_counts[pickup] += 1
        return_time_counts[ret_time] += 1

        passengers.append(
            TransportPassengerRow(
                guest_id=g["id"],
                full_name=f"{g['first_name']} {g['last_name']}",
                age_category=g.get("age_category") or "adult",
                rsvp_status=g.get("rsvp_status") or "pending",
                transport_pickup=pickup,
                transport_return_time=ret_time,
                table_name=g.get("table_name") or "Nieprzypisany",
            )
        )

    return TransportReportSummary(
        wedding_name=wedding_name,
        total_passengers=len(passengers),
        pickup_counts=dict(pickup_counts),
        return_time_counts=dict(return_time_counts),
        passengers=passengers,
    )


@router.get("/transport/summary", response_model=TransportReportSummary)
def get_transport_summary(current_user: UserResponse = Depends(get_current_user)):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        return _build_transport_data(client, wid)


@router.get("/transport/export")
def export_transport_report(
    format: Literal["pdf", "xlsx", "csv"] = Query("pdf"),
    current_user: UserResponse = Depends(get_current_user),
):
    with get_db() as client:
        wid = _get_or_create_wedding_id(client, current_user)
        summary = _build_transport_data(client, wid)

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerow(["Lp.", "Pasażer", "Przystanek odbioru", "Kurs powrotny", "Status RSVP", "Stół"])
        for i, p in enumerate(summary.passengers, start=1):
            writer.writerow([i, p.full_name, p.transport_pickup, p.transport_return_time, p.rsvp_status, p.table_name])
        bom_bytes = ("\ufeff" + output.getvalue()).encode("utf-8")
        return StreamingResponse(
            io.BytesIO(bom_bytes),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="lista_transport_kierowca.csv"'},
        )

    if format == "xlsx":
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Transport Bus"

        header_fill = PatternFill(start_color="059669", end_color="059669", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)

        ws.append([f"Lista Pasażerów (Bus / Transfery) – {summary.wedding_name}"])
        ws["A1"].font = Font(size=14, bold=True)
        ws.append([f"Łącznie pasażerów: {summary.total_passengers}"])
        ws.append([])

        ws.append(["Lp.", "Imię i Nazwisko", "Przystanek odbioru", "Godzina powrotu", "Status RSVP", "Stół"])
        for cell in ws[4]:
            cell.fill = header_fill
            cell.font = header_font

        for i, p in enumerate(summary.passengers, start=1):
            ws.append([i, p.full_name, p.transport_pickup, p.transport_return_time, p.rsvp_status, p.table_name])

        stream = io.BytesIO()
        wb.save(stream)
        stream.seek(0)
        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="lista_transport_kierowca.xlsx"'},
        )

    reg_font, bold_font = _register_polish_pdf_fonts()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=15 * mm, bottomMargin=15 * mm)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("TitlePL", parent=styles["Heading1"], fontName=bold_font, fontSize=16, spaceAfter=6)
    sub_style = ParagraphStyle("SubPL", parent=styles["Normal"], fontName=reg_font, fontSize=9.5, textColor=colors.HexColor("#475569"), spaceAfter=12)

    pickups_str = ", ".join([f"{k}: {v} os." for k, v in summary.pickup_counts.items()]) or "Brak"
    returns_str = ", ".join([f"{k}: {v} os." for k, v in summary.return_time_counts.items()]) or "Brak"

    elements = [
        Paragraph(f"Manifest Transportowy dla Kierowcy – {summary.wedding_name}", title_style),
        Paragraph(
            f"Łącznie pasażerów: <b>{summary.total_passengers}</b><br/>"
            f"Przystanki: {pickups_str}<br/>"
            f"Kursy powrotne: {returns_str}",
            sub_style,
        ),
    ]

    tbl_data = [["Lp.", "Imię i Nazwisko", "Przystanek odbioru", "Powrót", "Stół"]]
    for i, p in enumerate(summary.passengers, start=1):
        tbl_data.append([str(i), p.full_name, p.transport_pickup, p.transport_return_time, p.table_name])

    tr_table = Table(tbl_data, colWidths=[12 * mm, 54 * mm, 54 * mm, 26 * mm, 34 * mm], hAlign="LEFT")
    tr_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), bold_font),
            ("FONTNAME", (0, 1), (-1, -1), reg_font),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("PADDING", (0, 0), (-1, -1), 5),
        ])
    )
    elements.append(tr_table)

    doc.build(elements)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="lista_transport_kierowca.pdf"'},
    )