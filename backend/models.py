from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ==========================================
# AUTH / USER SCHEMAS
# ==========================================

class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(min_length=6)
    wedding_name: Optional[str] = Field(default="Nasze Wesele", max_length=150)
    role_label: Optional[str] = Field(default="Para Młoda", max_length=100)


class UserLogin(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    is_approved: int = 0
    is_admin: int = 0
    wedding_id: Optional[int] = None
    role_label: Optional[str] = None
    dark_mode: int = 0
    created_at: Optional[Any] = None

    model_config = ConfigDict(from_attributes=True)

class UserDarkModeUpdate(BaseModel):
    dark_mode: int
    
class UserStatusUpdate(BaseModel):
    is_approved: int = Field(ge=0, le=1)


class UserPasswordReset(BaseModel):
    new_password: str = Field(min_length=6)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: Optional[str] = None

class InvitationSalutationUpdate(BaseModel):
    guest_ids: List[int] = []
    rsvp_group_id: Optional[str] = None
    invitation_salutation: str

# ==========================================
# WEDDING SETTINGS & CO-ORGANIZERS
# ==========================================

ThemeColor = Literal["emerald", "pink", "beige", "rose", "amber", "indigo", "burgundy"]


class WeddingSettingsBase(BaseModel):
    wedding_name: str = Field(min_length=1, max_length=150)
    wedding_date: Optional[str] = None
    venue_name: Optional[str] = None
    adult_weight: float = Field(default=1.0, ge=0.0, le=5.0)
    child_weight: float = Field(default=0.5, ge=0.0, le=5.0)
    toddler_weight: float = Field(default=0.0, ge=0.0, le=5.0)
    adult_age_desc: str = Field(default="powyżej 10 lat", max_length=100)
    child_age_desc: str = Field(default="3–10 lat", max_length=100)
    toddler_age_desc: str = Field(default="0–2 lata", max_length=100)
    plate_price: float = Field(default=350.0, ge=0.0)
    afterparty_price: float = Field(default=120.0, ge=0.0)
    hotel_price: float = Field(default=150.0, ge=0.0)
    theme_color: ThemeColor = "emerald"


class WeddingSettingsUpdate(BaseModel):
    wedding_name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    wedding_date: Optional[str] = None
    venue_name: Optional[str] = None
    adult_weight: Optional[float] = Field(default=None, ge=0.0, le=5.0)
    child_weight: Optional[float] = Field(default=None, ge=0.0, le=5.0)
    toddler_weight: Optional[float] = Field(default=None, ge=0.0, le=5.0)
    adult_age_desc: Optional[str] = Field(default=None, max_length=100)
    child_age_desc: Optional[str] = Field(default=None, max_length=100)
    toddler_age_desc: Optional[str] = Field(default=None, max_length=100)
    plate_price: Optional[float] = Field(default=None, ge=0.0)
    afterparty_price: Optional[float] = Field(default=None, ge=0.0)
    hotel_price: Optional[float] = Field(default=None, ge=0.0)
    theme_color: Optional[ThemeColor] = None


class WeddingSettingsResponse(WeddingSettingsBase):
    id: int
    created_at: Optional[Any] = None

    model_config = ConfigDict(from_attributes=True)


class WeddingMemberCreate(BaseModel):
    email: EmailStr
    password: Optional[str] = Field(default=None, min_length=6)
    role_label: str = Field(default="Współorganizator", min_length=1, max_length=100)


class WeddingMemberResponse(BaseModel):
    id: int
    email: EmailStr
    role_label: Optional[str] = "Para Młoda"
    is_approved: int
    is_admin: int
    created_at: Optional[Any] = None


# ==========================================
# ADMIN SYSTEM & DB METRICS
# ==========================================

class TableStat(BaseModel):
    table_name: str
    row_count: int


class DatabaseMetrics(BaseModel):
    total_size_bytes: int
    total_size_mb: float
    total_rows: int
    tables: List[TableStat]


class ServerMetrics(BaseModel):
    cpu_percent: float
    ram_total_gb: float
    ram_used_gb: float
    ram_percent: float
    disk_total_gb: float
    disk_used_gb: float
    disk_percent: float
    process_uptime_seconds: float
    python_version: str


class AdminSystemMetricsResponse(BaseModel):
    server: ServerMetrics
    database: DatabaseMetrics


# ==========================================
# WEDDING TABLES SCHEMAS
# ==========================================

TableShape = Literal["round", "rectangular"]


class WeddingTableBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    capacity: int = Field(gt=0)
    shape: TableShape = "round"


class WeddingTableCreate(WeddingTableBase):
    pass


class WeddingTableUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    capacity: Optional[int] = Field(default=None, gt=0)
    shape: Optional[TableShape] = None


class WeddingTableResponse(WeddingTableBase):
    id: int
    assigned_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# GUESTS SCHEMAS
# ==========================================

AgeCategory = Literal["adult", "child", "toddler"]
RSVPStatus = Literal["confirmed", "declined", "pending"]
AccommodationPayer = Literal["couple", "guest"]


class GuestBase(BaseModel):
    table_id: Optional[int] = None
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    age_category: AgeCategory = "adult"
    rsvp_status: RSVPStatus = "pending"
    diet: str = "standard"
    needs_hotel: int = Field(default=0, ge=0, le=1)
    room_number: Optional[str] = Field(default=None, max_length=50)
    nights_count: int = Field(default=1, ge=1, le=30)
    accommodation_payer: AccommodationPayer = "couple"
    invitation_salutation: Optional[str] = Field(default=None, max_length=250)
    needs_transport: int = Field(default=0, ge=0, le=1)
    transport_pickup: Optional[str] = Field(default=None, max_length=150)
    transport_return_time: Optional[str] = Field(default=None, max_length=50)
    seating_notes: Optional[str] = Field(default=None, max_length=250)
    rsvp_group_id: Optional[str] = None
    rsvp_token: Optional[str] = None
    invite_sent: int = Field(default=0, ge=0, le=1)


class GuestCreate(GuestBase):
    pass


class GuestUpdate(BaseModel):
    table_id: Optional[int] = None
    first_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    age_category: Optional[AgeCategory] = None
    rsvp_status: Optional[RSVPStatus] = None
    diet: Optional[str] = None
    needs_hotel: Optional[int] = Field(default=None, ge=0, le=1)
    room_number: Optional[str] = Field(default=None, max_length=50)
    nights_count: Optional[int] = Field(default=None, ge=1, le=30)
    accommodation_payer: Optional[AccommodationPayer] = None
    invitation_salutation: Optional[str] = Field(default=None, max_length=250)
    needs_transport: Optional[int] = Field(default=None, ge=0, le=1)
    transport_pickup: Optional[str] = Field(default=None, max_length=150)
    transport_return_time: Optional[str] = Field(default=None, max_length=50)
    seating_notes: Optional[str] = Field(default=None, max_length=250)
    rsvp_group_id: Optional[str] = None
    rsvp_token: Optional[str] = None
    invite_sent: Optional[int] = Field(default=None, ge=0, le=1)


class GuestAssignTable(BaseModel):
    table_id: Optional[int] = None


class GuestResponse(GuestBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class PublicGuestRSVPUpdate(BaseModel):
    id: int
    rsvp_status: RSVPStatus
    diet: str
    needs_hotel: int = Field(ge=0, le=1)
    needs_transport: Optional[int] = Field(default=None, ge=0, le=1)
    transport_pickup: Optional[str] = None
    transport_return_time: Optional[str] = None


class PublicRSVPSubmit(BaseModel):
    guests: List[PublicGuestRSVPUpdate]


# ==========================================
# REPORTS & GENERATORS (MODULE 1, 2 & 3)
# ==========================================

class TableCateringBreakdown(BaseModel):
    table_id: Optional[int] = None
    table_name: str
    physical_guests: int
    weighted_plates: float
    diets: Dict[str, int]


class CateringReportSummary(BaseModel):
    wedding_name: str
    total_active_guests: int
    total_weighted_plates: float
    age_breakdown: Dict[str, int]
    diet_totals: Dict[str, int]
    tables_breakdown: List[TableCateringBreakdown]


class HotelGuestRow(BaseModel):
    guest_id: int
    full_name: str
    age_category: str
    rsvp_status: str
    rsvp_group_id: Optional[str] = None
    room_number: str
    nights_count: int
    accommodation_payer: str
    estimated_cost: float


class HotelReportSummary(BaseModel):
    wedding_name: str
    hotel_price_per_night: float
    total_hotel_guests: int
    total_person_nights: int
    couple_covered_cost: float
    guest_covered_cost: float
    rows: List[HotelGuestRow]


class InvitationPreviewItem(BaseModel):
    rsvp_group_id: str
    guest_ids: List[int] = []
    salutation: str
    members_names: List[str]
    members_count: int
    rsvp_token: str
    rsvp_url: str
    qr_filename: str
    invite_sent: int


class PlaceCardPreviewItem(BaseModel):
    guest_id: int
    display_name: str
    first_name: str
    last_name: str
    table_name: str
    age_category: str
    diet: str


class TransportPassengerRow(BaseModel):
    guest_id: int
    full_name: str
    age_category: str
    rsvp_status: str
    transport_pickup: str
    transport_return_time: str
    table_name: str


class TransportReportSummary(BaseModel):
    wedding_name: str
    total_passengers: int
    pickup_counts: Dict[str, int]
    return_time_counts: Dict[str, int]
    passengers: List[TransportPassengerRow]


# ==========================================
# BUDGET & INSTALLMENTS SCHEMAS
# ==========================================

class BudgetItemBase(BaseModel):
    category: str = Field(min_length=1, max_length=100)
    item_name: str = Field(min_length=1, max_length=200)
    estimated_cost: float = Field(default=0.0, ge=0.0)
    actual_cost: float = Field(default=0.0, ge=0.0)
    paid: int = Field(default=0, ge=0, le=1)


class BudgetItemCreate(BudgetItemBase):
    pass


class BudgetItemUpdate(BaseModel):
    category: Optional[str] = Field(default=None, min_length=1, max_length=100)
    item_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    estimated_cost: Optional[float] = Field(default=None, ge=0.0)
    actual_cost: Optional[float] = Field(default=None, ge=0.0)
    paid: Optional[int] = Field(default=None, ge=0, le=1)


class BudgetItemResponse(BudgetItemBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class BudgetInstallmentBase(BaseModel):
    budget_item_id: int
    installment_name: str = Field(min_length=1, max_length=100)
    amount: float = Field(ge=0.0)
    due_date: Optional[str] = None
    paid: int = Field(default=0, ge=0, le=1)
    notes: Optional[str] = None


class BudgetInstallmentCreate(BudgetInstallmentBase):
    pass


class BudgetInstallmentUpdate(BaseModel):
    installment_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    amount: Optional[float] = Field(default=None, ge=0.0)
    due_date: Optional[str] = None
    paid: Optional[int] = Field(default=None, ge=0, le=1)
    notes: Optional[str] = None


class BudgetInstallmentResponse(BudgetInstallmentBase):
    id: int
    item_name: Optional[str] = None
    category: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UpcomingInstallmentAlert(BaseModel):
    id: int
    budget_item_id: int
    item_name: str
    category: str
    installment_name: str
    amount: float
    due_date: str
    is_overdue: bool
    days_remaining: int


# ==========================================
# CHECKLIST SCHEMAS
# ==========================================

class ChecklistTaskBase(BaseModel):
    stage: str = Field(default="6+ miesięcy przed", min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    assigned_to: Optional[str] = Field(default="Para Młoda", max_length=100)
    due_date: Optional[str] = None
    is_completed: int = Field(default=0, ge=0, le=1)


class ChecklistTaskCreate(ChecklistTaskBase):
    pass


class ChecklistTaskUpdate(BaseModel):
    stage: Optional[str] = Field(default=None, min_length=1, max_length=100)
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    assigned_to: Optional[str] = Field(default=None, max_length=100)
    due_date: Optional[str] = None
    is_completed: Optional[int] = Field(default=None, ge=0, le=1)


class ChecklistTaskResponse(ChecklistTaskBase):
    id: int
    created_at: Optional[Any] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# TIMELINE SCHEMAS
# ==========================================

class TimelineEventBase(BaseModel):
    time_start: str = Field(pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    assigned_person: Optional[str] = None


class TimelineEventCreate(TimelineEventBase):
    pass


class TimelineEventUpdate(BaseModel):
    time_start: Optional[str] = Field(default=None, pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    assigned_person: Optional[str] = None


class TimelineEventResponse(TimelineEventBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# VENDOR SCHEMAS
# ==========================================

class VendorBase(BaseModel):
    category: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    contact_phone: Optional[str] = None
    price: float = Field(default=0.0, ge=0.0)
    contract_signed: int = Field(default=0, ge=0, le=1)


class VendorCreate(VendorBase):
    pass


class VendorUpdate(BaseModel):
    category: Optional[str] = Field(default=None, min_length=1, max_length=100)
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    contact_phone: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0.0)
    contract_signed: Optional[int] = Field(default=None, ge=0, le=1)


class VendorResponse(VendorBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# DASHBOARD SCHEMAS
# ==========================================

class DashboardStats(BaseModel):
    wedding_name: str
    wedding_date: Optional[str] = None
    total_physical_guests: int
    weighted_guest_count: float
    confirmed_guests: int
    declined_guests: int
    pending_guests: int
    hotel_guests_count: int
    transport_guests_count: int
    assigned_seats: int
    total_capacity: int
    estimated_budget: float
    actual_budget: float
    remaining_to_pay: float
    catering_estimated_cost: float
    afterparty_estimated_cost: float
    hotel_estimated_cost: float
    plate_price: float
    afterparty_price: float
    hotel_price: float
    adult_weight: float
    child_weight: float
    toddler_weight: float
    upcoming_timeline: List[TimelineEventResponse]
    upcoming_installments: List[UpcomingInstallmentAlert]

class InvitationTemplateSettings(BaseModel):
    width_mm: float = 105.0
    height_mm: float = 148.0
    text_x_pct: float = 10.0
    text_y_pct: float = 45.0
    box_w_pct: float = 80.0
    box_h_pct: float = 25.0
    font_family: str = "DejaVuSerif"
    font_size: float = 16.0
    font_color: str = "#1f2937"
    text_align: str = "center"


class InvitationsPdfExportRequest(BaseModel):
    salutations: List[str]
    per_page: int = 4
    crop_marks: bool = True


class QrCardItem(BaseModel):
    salutation: str
    rsvp_url: str


class QrCardsPdfExportRequest(BaseModel):
    cards: List[QrCardItem]
    custom_message: str
    card_w_mm: float = 85.0
    card_h_mm: float = 55.0
    font_family: str = "DejaVuSerif"
    font_size: float = 9.5
    text_color: str = "#1f2937"
    bg_color: str = "#ffffff"
    border_color: str = "#cbd5e1"
    border_style: str = "solid"  # "solid" | "double" | "dashed" | "none"
    qr_color: str = "#065f46"
    qr_style: str = "rounded"    # "square" | "rounded" | "dots" | "gapped"
    qr_position: str = "right"   # "right" | "left" | "bottom"
    show_salutation: bool = True
    crop_marks: bool = True

class VendorCandidateGroupCreate(BaseModel):
    name: str
    sort_order: int = 0


class VendorCandidateGroupUpdate(BaseModel):
    name: str
    sort_order: Optional[int] = None


class VendorCandidateCreate(BaseModel):
    group_id: int
    name: str
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    website_url: Optional[str] = None
    offered_price: float = 0.0
    rating: int = 0
    pros: Optional[str] = None
    cons: Optional[str] = None
    notes: Optional[str] = None
    status: str = "considering"


class VendorCandidateUpdate(BaseModel):
    group_id: int
    name: str
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    website_url: Optional[str] = None
    offered_price: float = 0.0
    rating: int = 0
    pros: Optional[str] = None
    cons: Optional[str] = None
    notes: Optional[str] = None
    status: str = "considering"


class VendorCandidatePromote(BaseModel):
    add_to_budget: bool = True
    contract_signed: bool = False