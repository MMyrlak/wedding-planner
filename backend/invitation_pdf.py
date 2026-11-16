import base64
import io
import os
import subprocess
import tempfile
import fitz  # PyMuPDF
import qrcode
from PIL import Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

FONTS_MAP = {
    "DejaVuSans": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "DejaVuSansBold": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "DejaVuSerif": "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    "DejaVuSerifBold": "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
}

for font_name, path in FONTS_MAP.items():
    if os.path.exists(path) and font_name not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(font_name, path))


def process_uploaded_template(filename: str, file_bytes: bytes) -> str:
    ext = os.path.splitext(filename.lower())[1]

    if ext == ".docx":
        with tempfile.TemporaryDirectory() as tmpdir:
            docx_path = os.path.join(tmpdir, "template.docx")
            with open(docx_path, "wb") as f:
                f.write(file_bytes)

            subprocess.run(
                ["soffice", "--headless", "--convert-to", "pdf", "--outdir", tmpdir, docx_path],
                check=True,
                timeout=45,
            )
            pdf_path = os.path.join(tmpdir, "template.pdf")
            doc = fitz.open(pdf_path)
            page = doc.load_page(0)
            pix = page.get_pixmap(dpi=300)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
    elif ext in {".png", ".jpg", ".jpeg", ".webp"}:
        img = Image.open(io.BytesIO(file_bytes))
    else:
        raise ValueError("Obsługiwane formaty to PNG, JPG, WEBP oraz DOCX")

    if img.width > 1800:
        ratio = 1800 / img.width
        img = img.resize((1800, int(img.height * ratio)), Image.Resampling.LANCZOS)

    out = io.BytesIO()
    img.convert("RGBA").save(out, format="PNG", optimize=True)
    return base64.b64encode(out.getvalue()).decode("utf-8")


def build_invitations_a4_pdf(
    salutations: list[str],
    tpl: dict,
    per_page: int = 4,
    crop_marks: bool = True,
) -> bytes:
    buf = io.BytesIO()
    inv_w = float(tpl["width_mm"]) * mm
    inv_h = float(tpl["height_mm"]) * mm

    if per_page == 1:
        page_size = A4
        cols, rows = 1, 1
    elif per_page == 2:
        page_size = landscape(A4) if inv_w * 2 <= 297 * mm and inv_h <= 210 * mm else A4
        cols, rows = (2, 1) if page_size == landscape(A4) else (1, 2)
    else:
        page_size = A4
        cols, rows = 2, 2

    page_w, page_h = page_size
    c = canvas.Canvas(buf, pagesize=page_size)

    img_bytes = base64.b64decode(tpl["image_base64"])
    bg_image = ImageReader(io.BytesIO(img_bytes))

    align_map = {"left": TA_LEFT, "center": TA_CENTER, "right": TA_RIGHT}
    font_name = (
        tpl["font_family"]
        if tpl.get("font_family") in pdfmetrics.getRegisteredFontNames()
        else "DejaVuSerif"
    )
    font_size = float(tpl.get("font_size", 16.0))

    style = ParagraphStyle(
        name="InviteText",
        fontName=font_name,
        fontSize=font_size,
        leading=font_size * 1.25,
        textColor=colors.HexColor(tpl.get("font_color", "#1f2937")),
        alignment=align_map.get(tpl.get("text_align", "center"), TA_CENTER),
    )

    grid_w = cols * inv_w
    grid_h = rows * inv_h
    start_x = max(0, (page_w - grid_w) / 2)
    start_y = max(0, (page_h - grid_h) / 2)
    slots_per_page = cols * rows

    for idx, text in enumerate(salutations):
        slot = idx % slots_per_page
        if idx > 0 and slot == 0:
            c.showPage()

        col = slot % cols
        row = slot // cols

        x0 = start_x + col * inv_w
        y0 = page_h - start_y - (row + 1) * inv_h

        c.drawImage(bg_image, x0, y0, width=inv_w, height=inv_h, preserveAspectRatio=False, mask="auto")

        box_x = x0 + (float(tpl["text_x_pct"]) / 100.0) * inv_w
        box_w = (float(tpl["box_w_pct"]) / 100.0) * inv_w
        box_h = (float(tpl["box_h_pct"]) / 100.0) * inv_h
        box_top = y0 + inv_h - (float(tpl["text_y_pct"]) / 100.0) * inv_h

        p = Paragraph(text.replace("\n", "<br/>"), style)
        _, actual_h = p.wrap(box_w, box_h)
        p.drawOn(c, box_x, box_top - actual_h)

        if crop_marks:
            c.setStrokeColor(colors.grey)
            c.setLineWidth(0.4)
            m = 3 * mm
            for cx in (x0, x0 + inv_w):
                for cy in (y0, y0 + inv_h):
                    c.line(cx - m, cy, cx + m, cy)
                    c.line(cx, cy - m, cx, cy + m)

    c.save()
    return buf.getvalue()


def build_qr_cards_a4_pdf(
    cards: list[dict],
    custom_message: str,
    card_w_mm: float = 85.0,
    card_h_mm: float = 55.0,
    font_family: str = "DejaVuSans",
    font_size: float = 9.5,
    show_salutation: bool = True,
) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    page_w, page_h = A4

    cw = card_w_mm * mm
    ch = card_h_mm * mm
    cols = max(1, int((page_w - 10 * mm) // cw))
    rows = max(1, int((page_h - 10 * mm) // ch))

    start_x = (page_w - cols * cw) / 2
    start_y = (page_h - rows * ch) / 2
    per_page = cols * rows

    f_name = font_family if font_family in pdfmetrics.getRegisteredFontNames() else "DejaVuSans"
    text_style = ParagraphStyle(
        name="QrCardText",
        fontName=f_name,
        fontSize=font_size,
        leading=font_size * 1.25,
        textColor=colors.HexColor("#1f2937"),
        alignment=TA_LEFT,
    )

    for idx, item in enumerate(cards):
        slot = idx % per_page
        if idx > 0 and slot == 0:
            c.showPage()

        col = slot % cols
        row = slot // cols
        x0 = start_x + col * cw
        y0 = page_h - start_y - (row + 1) * ch

        c.setStrokeColor(colors.lightgrey)
        c.setLineWidth(0.5)
        c.rect(x0, y0, cw, ch)

        qr_size = min(ch - 10 * mm, cw * 0.38)
        qr_img = qrcode.make(item["rsvp_url"]).convert("RGB")
        qr_buf = io.BytesIO()
        qr_img.save(qr_buf, format="PNG")
        qr_buf.seek(0)

        qr_x = x0 + cw - qr_size - 4 * mm
        qr_y = y0 + (ch - qr_size) / 2
        c.drawImage(ImageReader(qr_buf), qr_x, qr_y, width=qr_size, height=qr_size)

        header = f"<b>{item['salutation']}</b><br/>" if show_salutation and item.get("salutation") else ""
        body_html = f"{header}{custom_message.replace(chr(10), '<br/>')}"

        text_w = cw - qr_size - 11 * mm
        p = Paragraph(body_html, text_style)
        _, actual_h = p.wrap(text_w, ch - 8 * mm)
        p.drawOn(c, x0 + 4 * mm, y0 + (ch + actual_h) / 2 - actual_h)

    c.save()
    return buf.getvalue()