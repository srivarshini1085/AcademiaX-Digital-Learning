<#
  AcademiaX: run the whole stack without Docker (Windows PowerShell 5.1+ / PowerShell 7).

  Prerequisites: JDK 17+ (21 recommended), Maven 3.9+, Node 18+, a local MySQL 8 on port 3306.
  Values come from .env in this folder (copy .env.example to .env and fill it in).

  Usage:
    .\run-local.ps1              # build, then start every service in its own window, then the frontend
    .\run-local.ps1 -SkipBuild   # reuse the last build
    .\run-local.ps1 -NoFrontend  # backend only
  Stop everything with .\stop-local.ps1
#>
param(
    [switch]$SkipBuild,
    [switch]$NoFrontend
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$backend = Join-Path $root 'backend'
$runDir = Join-Path $root '.run'
$pidFile = Join-Path $runDir 'pids.txt'

# ---- Load .env into this process (child windows inherit it) ----
$envFile = Join-Path $root '.env'
if (-not (Test-Path $envFile)) {
    Write-Host ".env not found. Copy .env.example to .env and fill in DB_PASSWORD and JWT_SECRET." -ForegroundColor Red
    exit 1
}
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
        $name, $value = $line.Split('=', 2)
        $value = ($value -replace '\s+#.*$', '').Trim().Trim('"')
        Set-Item -Path "Env:$($name.Trim())" -Value $value
    }
}
if (-not $env:JWT_SECRET -or [Text.Encoding]::UTF8.GetByteCount($env:JWT_SECRET) -lt 32) {
    Write-Host "JWT_SECRET in .env must be at least 32 characters." -ForegroundColor Red
    exit 1
}
$env:DB_HOST = 'localhost'

# ---- Free ports check ----
$ports = 8761, 8081, 8082, 8092, 8083, 8093, 8084, 8085, 8080
$busy = $ports | Where-Object { Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue }
if ($busy) {
    Write-Host "Ports already in use: $($busy -join ', '). Run .\stop-local.ps1 first (or close whatever is using them)." -ForegroundColor Red
    exit 1
}

if (-not $SkipBuild) {
    Write-Host "Building backend (mvn -DskipTests package)..." -ForegroundColor Cyan
    Push-Location $backend
    mvn -q -DskipTests package
    $code = $LASTEXITCODE
    Pop-Location
    if ($code -ne 0) { Write-Host "Backend build failed." -ForegroundColor Red; exit 1 }
}

New-Item -ItemType Directory -Force $runDir | Out-Null
Set-Content -Path $pidFile -Value ''

function Start-Service([string]$module, [int]$port, [hashtable]$extraEnv = @{}) {
    $envSetup = "`$env:PORT='$port'; "
    foreach ($key in $extraEnv.Keys) { $envSetup += "`$env:$key='$($extraEnv[$key])'; " }
    $title = "$module@$port"
    $command = "`$Host.UI.RawUI.WindowTitle='$title'; $envSetup Set-Location '$backend'; mvn -q -pl $module spring-boot:run"
    $proc = Start-Process powershell -ArgumentList '-NoExit', '-Command', $command -PassThru
    Add-Content -Path $pidFile -Value $proc.Id
    Write-Host "  started $title (window pid $($proc.Id))"
}

function Wait-Healthy([string]$name, [int]$port, [int]$timeoutSeconds = 180) {
    $deadline = (Get-Date).AddSeconds($timeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $health = Invoke-RestMethod -Uri "http://localhost:$port/actuator/health" -TimeoutSec 3
            if ($health.status -eq 'UP') { Write-Host "  $name is UP" -ForegroundColor Green; return }
        } catch { }
        Start-Sleep -Seconds 3
    }
    Write-Host "  $name did not become healthy within $timeoutSeconds s; check its window for errors." -ForegroundColor Yellow
}

Write-Host "Starting services (each in its own window)..." -ForegroundColor Cyan
Start-Service 'eureka-server' 8761
Wait-Healthy 'eureka-server' 8761

Start-Service 'auth-service' 8081
Start-Service 'course-service' 8082
Start-Service 'notification-service' 8085
Start-Service 'payment-service' 8084
Wait-Healthy 'auth-service' 8081
Wait-Healthy 'course-service@8082' 8082

# Second course instance after the first, so only one seeds data
Start-Service 'course-service' 8092 @{ SEED_DATA = 'false' }
Start-Service 'enrollment-service' 8083
Wait-Healthy 'enrollment-service@8083' 8083
Start-Service 'enrollment-service' 8093 @{ SEED_DATA = 'false' }

Start-Service 'api-gateway' 8080
Wait-Healthy 'course-service@8092' 8092
Wait-Healthy 'enrollment-service@8093' 8093
Wait-Healthy 'api-gateway' 8080

if (-not $NoFrontend) {
    $frontend = Join-Path $root 'frontend'
    if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
        Push-Location $frontend; npm install; Pop-Location
    }
    $proc = Start-Process powershell -ArgumentList '-NoExit', '-Command', "`$Host.UI.RawUI.WindowTitle='frontend'; Set-Location '$frontend'; npm run dev" -PassThru
    Add-Content -Path $pidFile -Value $proc.Id
    Write-Host "  started frontend (window pid $($proc.Id))"
}

Write-Host ""
Write-Host "AcademiaX is up." -ForegroundColor Green
Write-Host "  App:      http://localhost:5173"
Write-Host "  Gateway:  http://localhost:8080"
Write-Host "  Eureka:   http://localhost:8761"
Write-Host "Demo data (enrollments and payments) is created in the background over the next ~30 seconds."
