-- 1. Użytkownicy / Pary Młode
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Stoły weselne
CREATE TABLE IF NOT EXISTS wedding_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 8,
    shape TEXT DEFAULT 'round' -- 'round', 'rectangular'
);

-- 3. Lista gości
CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    group_type TEXT DEFAULT 'inne', -- 'rodzina_mlodej', 'rodzina_mlodego', 'znajomi'
    rsvp_status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'declined'
    diet TEXT, -- 'standard', 'wege', 'wegan', 'bezgluten' itp.
    needs_hotel INTEGER DEFAULT 0, -- 0 = nie, 1 = tak
    table_id INTEGER,
    seat_number INTEGER,
    plus_one INTEGER DEFAULT 0,
    notes TEXT,
    FOREIGN KEY (table_id) REFERENCES wedding_tables (id) ON DELETE SET NULL
);

-- 4. Budżet i wydatki
CREATE TABLE IF NOT EXISTS budget_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL, -- 'sala', 'foto_video', 'muzyka', 'stroj', 'kwiaty' itp.
    name TEXT NOT NULL,
    estimated_cost REAL DEFAULT 0,
    actual_cost REAL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'planned' -- 'planned', 'booked', 'paid'
);

-- 5. Harmonogram dnia wesela / Oś czasu
CREATE TABLE IF NOT EXISTS timeline_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT NOT NULL, -- np. '15:30'
    title TEXT NOT NULL,
    responsible_person TEXT,
    description TEXT,
    completed INTEGER DEFAULT 0
);

-- 6. Podwykonawcy / Kontakty
CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT
);