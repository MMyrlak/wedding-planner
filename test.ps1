# 1. Logowanie i pobranie tokena
$loginBody = @{
    email = "mikolaj.myrlak@gmail.com"
    password = "Myrlak_2001"
} | ConvertTo-Json

$loginRes = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
$headers = @{
    Authorization = "Bearer $($loginRes.access_token)"
}

# 2. Pobranie statystyk Dashboardu
$stats = Invoke-RestMethod -Uri "http://localhost:8000/dashboard/stats" -Headers $headers
$stats | Format-List total_physical_guests, weighted_guest_count, confirmed_guests, total_capacity

# 3. Dodanie nowego gościa z automatycznym tokenem
$newGuest = @{
    first_name = "Jan"
    last_name = "Kowalski"
    age_category = "adult"
    diet = "standard"
    needs_hotel = 1
} | ConvertTo-Json

$guestRes = Invoke-RestMethod -Uri "http://localhost:8000/guests" -Method Post -Headers $headers -ContentType "application/json" -Body $newGuest
Write-Host "Utworzono gościa ID: $($guestRes.id), Token RSVP: $($guestRes.rsvp_token)"

# 4. Test publicznego endpointu RSVP (bez nagłówka Authorization)
$publicRsvp = Invoke-RestMethod -Uri "http://localhost:8000/guests/rsvp/$($guestRes.rsvp_token)" -Method Get
Write-Host "Pobrano publiczne zaproszenie dla: $($publicRsvp[0].first_name) $($publicRsvp[0].last_name)"

# 5. Test przypisania stołu (Drag & Drop endpoint)
$assignBody = @{ table_id = 1 } | ConvertTo-Json
$assigned = Invoke-RestMethod -Uri "http://localhost:8000/guests/$($guestRes.id)/assign-table" -Method Patch -Headers $headers -ContentType "application/json" -Body $assignBody
Write-Host "Gość przypisany do stołu ID: $($assigned.table_id)"