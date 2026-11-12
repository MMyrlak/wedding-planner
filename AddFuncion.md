Kontynuujemy rozwój aplikacji full-stack „Wedding Planner”.

### Aktualny stos technologiczny i struktura:
- **Backend:** Python (FastAPI, Uvicorn, Pydantic, PyJWT, passlib[bcrypt], libsql-client), wirtualne środowisko w `backend/venv` (Windows PowerShell).
- **Baza danych:** Turso (libSQL) – obecne tabele: `users`, `weddings`, `wedding_tables`, `guests`, `budget_items`, `timeline_events`, `vendors` (izolacja danych po `wedding_id`, automatyczne migracje schematu przy starcie w `init_db`).
- **Frontend:** React 18 + Vite + Tailwind CSS v3 + Axios (z interceptorami JWT) + Lucide React + `@hello-pangea/dnd` + `XLSX`.
- **Infrastruktura:** Pełna konteneryzacja Docker (`docker-compose.yml`), panel `/admin` z monitoringiem zasobów i zatwierdzaniem kont (`is_approved`), 7 motywów kolorystycznych + Dark Mode.

### Wdrożone dotychczas moduły:
1. Autoryzacja JWT + bcrypt, zatwierdzanie kont, wiele kont do jednego wesela (`role_label`).
2. Dashboard: licznik gości fizycznych i przeliczeniowych (wagi wiekowe), podsumowanie RSVP na żywo, pasek miejsc przy stołach, estymacja kosztów zmiennych oraz skrót budżetu i harmonogramu.
3. Zarządzanie Gośćmi i publiczny widok `/rsvp/:token`: pełny CRUD, filtrowanie, grupowanie zaproszeń (`rsvp_group_id`, `rsvp_token`), masowe operacje, import/eksport Excel.
4. Interaktywny Plan Stołów (Drag & Drop) z walidacją pojemności (`capacity`) i ikonami diet/noclegów.
5. Kalkulator budżetu (9 kategorii), Harmonogram dnia (`Timeline`), Rejestr usługodawców, Konfiguracja wesela (cennik, wagi wiekowe, motywy).

---

### Nowe zadania do zaprojektowania i wdrożenia (Faza 2):

#### 1. Wydruki i raporty „na salę” (PDF / CSV / XLSX)
- **Raport cateringowy dla kuchni:** Zbiorcze podsumowanie dla szefa kuchni: liczba talerzyków przeliczeniowych oraz dokładne zestawienie diet (wegetariańska, wegańska, bezglutenowa, dziecięca itp.) z przypisaniem do konkretnych numerów stołów (np. „Stół 4: 2x wege, 1x bez glutenu”).
- **Lista hotelowa dla recepcji:** Rozbudowa modelu gościa o pola noclegowe (`room_number`, `nights_count`, `accommodation_payer` – Para Młoda vs gość) oraz eksport gotowej tabeli z podziałem na pokoje/rodziny, liczbą dób i rozliczeniem płatnika.

#### 2. Generator zaproszeń, kodów QR i winietek
- **Generator listy i treści zaproszeń (dla drukarni / personalizacji):** Eksport gotowej listy par/rodzin pogrupowanej po `rsvp_group_id` w formie odmienionej lub sformatowanej do druku (np. „Sz.P. Annę i Jana Kowalskich z dziećmi”), połączonej z indywidualnym linkiem RSVP i identyfikatorem kodu QR – gotowej do przekazania bezpośrednio do drukarni pod personalizację kopert i wkładek.
- **Generowanie kodów QR (`.zip`):** Endpoint i przycisk pobierający archiwum `.zip` z wygenerowanymi kodami QR (`qrcode[pil]`) prowadzącymi bezpośrednio do `/rsvp/:token` (wraz z plikiem kontrolnym CSV mapującym nazwy plików graficznych na konkretne zaproszenia).
- **Eksport listy pod winietki (`.xlsx` / `.csv`):** Eksport sformatowany wyłącznie dla gości ze statusem `confirmed`, automatycznie wykluczający dzieci bez własnego miejsca (`toddler_weight == 0`) oraz anonimowe wpisy typu „Osoba Towarzysząca” bez podanego imienia.

#### 3. Logistyka transportu (Bus / Transfery)
- Rozbudowa modelu gościa o pola transportowe: `needs_transport` (bool), `transport_pickup` (kierunek / przystanek odbioru) oraz `transport_return_time` (godzina powrotu, np. kurs 01:00 vs 03:00).
- Widok / eksport gotowej listy pasażerów z podziałem na przystanki i godziny kursów dla kierowcy.

#### 4. Zarządzanie płatnościami ratalnymi i zadaniami (Checklist)
- **Harmonogram płatności (Zaliczki vs Dopłaty):** Rozbicie pozycji budżetowych (`budget_items` lub powiązana tabela `budget_installments`) na raty (zadatek, II rata, dopłata) z kwotą, datą wymagalności (`due_date`) i statusem opłacenia. Dodanie na Dashboardzie alertu o zbliżających się lub przeterminowanych płatnościach.
- **Checklista przedślubna (To-Do):** Nowy moduł i tabela `checklist_tasks` z podziałem na etapy czasowe (np. „6 miesięcy przed”, „1 miesiąc przed”, „Tydzień przed”), statusem wykonania oraz przypisaniem do konkretnego członka zespołu organizacyjnego (Panna Młoda, Pan Młody, Świadkowie).

#### 5. Bezpieczeństwo i ergonomia w produkcji
- **Kopia zapasowa (Backup) i reset hasła:** Przycisk w panelu administratora `/admin` (oraz w ustawieniach wesela) pozwalający pobrać pełny zrzut danych danego wesela do pliku JSON/Excel (na wypadek braku zasięgu na sali) oraz mechanizm resetowania/odzyskiwania hasła użytkownika.
- **Notatki „Ważne relacje” przy planie stołów:** Dodanie pola `seating_notes` przy gościach (np. „nie sadzać obok X”, „bliska rodzina z zagranicy”) wyświetlanego jako wyraźny tag/dymek na kafelkach w widoku Drag & Drop.

---

### Zasady pracy:
- Zachowaj spójność z obecną architekturą (`wedding_id`, migracje w `init_db`, styl Tailwind CSS v3 + obsługa Dark Mode i 7 motywów kolorystycznych).
- Wdrażaj zmiany etapami (najpierw migracje bazy + modele Pydantic + routery FastAPI, a następnie komponenty React). Zacznij od przedstawienia planu zmian w schemacie bazy Turso i realizacji Modułu 1 oraz 2.