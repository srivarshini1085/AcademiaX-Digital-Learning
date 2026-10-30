<#
  AcademiaX: stop everything started by run-local.ps1.
  Kills each service window and its child Java/Node processes, then frees any leftover listeners on the AcademiaX ports.
#>
$root = $PSScriptRoot
$pidFile = Join-Path $root '.run\pids.txt'

if (Test-Path $pidFile) {
    Get-Content $pidFile | Where-Object { $_ -match '^\d+$' } | ForEach-Object {
        taskkill /PID $_ /T /F 2>$null | Out-Null
    }
    Remove-Item $pidFile -Force
}

$ports = 8761, 8081, 8082, 8092, 8083, 8093, 8084, 8085, 8080, 5173
foreach ($port in $ports) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
Write-Host "AcademiaX stopped." -ForegroundColor Green
