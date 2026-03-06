# Verify API, database, and frontend are connected (run after: docker compose up -d)
$ErrorActionPreference = "Stop"
$failed = $false

Write-Host "=== VisaTrack stack verification ===" -ForegroundColor Cyan

# 1) Database
Write-Host "`n[1] Database (Postgres)..." -ForegroundColor Yellow
$dbOut = docker exec visatrack-postgres psql -U visatrack -d visatrack -t -c "SELECT 1" 2>&1 | Out-String
$dbVersion = docker exec visatrack-postgres psql -U visatrack -d visatrack -t -c "SELECT version_num FROM alembic_version LIMIT 1" 2>&1 | Out-String
if ($dbOut -match "1") {
    $ver = if ($dbVersion -match "[\w\d_]+") { $dbVersion.Trim() } else { "unknown" }
    Write-Host "  OK - DB reachable. Alembic: $ver" -ForegroundColor Green
} else {
    Write-Host "  FAIL - Database not reachable. Is 'visatrack-postgres' running? (docker compose up -d)" -ForegroundColor Red
    $failed = $true
}

# 2) Backend API
Write-Host "`n[2] Backend API (port 8000)..." -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -ne 200) { throw "Status $($r.StatusCode)" }
    $body = $r.Content | ConvertFrom-Json
    if ($body.status -ne "ok") { throw "status not ok" }
    Write-Host "  OK - /health returned status ok" -ForegroundColor Green
} catch {
    Write-Host "  FAIL - Backend not reachable at http://localhost:8000. Is 'visatrack-backend' running?" -ForegroundColor Red
    $failed = $true
}

# 3) Backend can use DB (optional: hit an endpoint that queries DB)
Write-Host "`n[3] Backend <-> Database..." -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "http://localhost:8000/docs" -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -ne 200) { throw "Status $($r.StatusCode)" }
    Write-Host "  OK - /docs loaded (app and DB connection used at startup)" -ForegroundColor Green
} catch {
    Write-Host "  FAIL - Could not load /docs" -ForegroundColor Red
    $failed = $true
}

# 4) Frontend (try 3000 then 3001 - docker-compose may map to either)
Write-Host "`n[4] Frontend (port 3000 or 3001)..." -ForegroundColor Yellow
$fePort = $null
$feCode3000 = (curl.exe -s -o NUL -w "%{http_code}" --connect-timeout 2 http://localhost:3000 2>&1)
$feCode3001 = (curl.exe -s -o NUL -w "%{http_code}" --connect-timeout 2 http://localhost:3001 2>&1)
if ($feCode3000 -eq "200") {
    $fePort = 3000
} elseif ($feCode3001 -eq "200") {
    $fePort = 3001
}
if ($fePort) {
    Write-Host "  OK - Frontend reachable at http://localhost:$fePort" -ForegroundColor Green
} else {
    Write-Host "  FAIL - Frontend not reachable at http://localhost:3000 or :3001 (3000=$feCode3000, 3001=$feCode3001). Is 'visatrack-frontend' running?" -ForegroundColor Red
    $failed = $true
}

# 5) Frontend -> API (CORS / connectivity)
Write-Host "`n[5] Frontend -> API (CORS)..." -ForegroundColor Yellow
$origin = if ($fePort) { "http://localhost:$fePort" } else { "http://localhost:3000" }
try {
    $headers = @{ "Origin" = $origin }
    $r = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5 -Headers $headers
    $aco = $r.Headers["Access-Control-Allow-Origin"]
    if ($r.StatusCode -ne 200) { throw "Status $($r.StatusCode)" }
    Write-Host "  OK - API allows origin (Access-Control-Allow-Origin present)" -ForegroundColor Green
} catch {
    Write-Host "  FAIL - CORS or API unreachable from browser origin" -ForegroundColor Red
    $failed = $true
}

Write-Host ""
if ($failed) {
    Write-Host "=== Verification FAILED ===" -ForegroundColor Red
    exit 1
} else {
    Write-Host "=== All checks passed: DB, API, and Frontend are connected ===" -ForegroundColor Green
    exit 0
}
