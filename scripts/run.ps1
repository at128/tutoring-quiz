# Runs Tutoring Quiz with one command on Windows. Use run.cmd in the repo root (double-click it, or `.\run.cmd` in
# PowerShell or cmd), which starts this script without changing the PowerShell execution policy.
#   run.cmd            start, or rebuild after an update (your data is kept)
#   run.cmd --reset    start over with fresh sample data
#   run.cmd --stop     stop it (your data is kept)
# Same as `docker compose up --build`, plus the checks. Another port: set APP_PORT=9090 first; no browser: TQ_NO_BROWSER=1.
# Read from $args, not param(): powershell -File would bind '--stop' to no parameter at all.
if ($args.Count -gt 1) { Write-Host '  Use one option at a time: --reset, --stop or --help.' -ForegroundColor Red; exit 1 }
$Mode = if ($args.Count -eq 1) { [string]$args[0] } else { '' }

$ErrorActionPreference = 'Continue'
Set-Location (Split-Path -Parent $PSScriptRoot)

function Fail([string]$Message) {
    Write-Host ''
    Write-Host "  $Message" -ForegroundColor Red
    Write-Host ''
    exit 1
}

switch -Regex ($Mode) {
    '^$' { $Mode = 'start' }
    '^(--|-|/)reset$' { $Mode = 'reset' }
    '^(--|-|/)stop$' { $Mode = 'stop' }
    '^(--|-|/)(h|help|\?)$' { Get-Content $PSCommandPath -TotalCount 6 | ForEach-Object { $_.Substring([Math]::Min(2, $_.Length)) }; exit 0 }
    default { Fail "Unknown option: $Mode (use --reset, --stop or --help)" }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail "Docker isn't installed. Install Docker Desktop (https://www.docker.com/products/docker-desktop/), start it, then run run.cmd again."
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail "Docker isn't running. Start Docker Desktop, wait until it says it's running, then run run.cmd again." }
docker compose version *> $null
if ($LASTEXITCODE -ne 0) { Fail 'Docker Compose v2 is missing. Update Docker Desktop.' }

if ($Mode -eq 'stop') {
    docker compose stop
    Write-Host ''
    Write-Host '  Stopped. Your data is kept: run.cmd starts it again.'
    Write-Host ''
    exit 0
}
if ($Mode -eq 'reset') { docker compose down --volumes }

function Test-Listening([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try { return $client.ConnectAsync('127.0.0.1', $Port).Wait(300) } catch { return $false } finally { $client.Dispose() }
}

# The port of a copy that's already running, else the first free one from 8080.
$port = $env:APP_PORT
if (-not $port) {
    $published = docker compose port app 8080 2> $null
    if ($LASTEXITCODE -eq 0 -and "$published" -match ':(\d+)\s*$') { $port = $Matches[1] }
}
if (-not $port) {
    $port = 8080..8089 | Where-Object { -not (Test-Listening $_) } | Select-Object -First 1
}
if (-not $port) { Fail 'Ports 8080-8089 are all in use. Pick another one: set APP_PORT=9090, then run run.cmd again.' }

Write-Host ''
Write-Host "  Building and starting Tutoring Quiz on port $port. The first build takes a few minutes."
Write-Host ''
$env:APP_PORT = "$port"
docker compose up --detach --build
if ($LASTEXITCODE -ne 0) { Fail 'Docker could not build or start the app. The messages above say why.' }

$url = "http://localhost:$port"
Write-Host ''
Write-Host -NoNewline '  Waiting for the app to answer'
$ready = $false
for ($i = 0; $i -lt 90; $i++) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "$url/api/health" -TimeoutSec 3
        if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
    Write-Host -NoNewline '.'
    Start-Sleep -Seconds 2
}
Write-Host ''
if (-not $ready) {
    docker compose logs --tail 40 app
    Fail "The app didn't start within 3 minutes. The log is above; run.cmd --reset starts over with fresh data."
}

# This computer's LAN address: the source address the OS would use to reach the internet (no packet is sent).
$lanIp = $null
try {
    $socket = New-Object System.Net.Sockets.Socket([System.Net.Sockets.AddressFamily]::InterNetwork, [System.Net.Sockets.SocketType]::Dgram, [System.Net.Sockets.ProtocolType]::Udp)
    $socket.Connect('8.8.8.8', 53)
    $lanIp = $socket.LocalEndPoint.Address.ToString()
    $socket.Dispose()
} catch { }
if (-not $lanIp) { $lanIp = "<this computer's Wi-Fi IP>" }

Write-Host ''
Write-Host '  Tutoring Quiz is running.' -ForegroundColor Green
Write-Host ''
Write-Host "    On this computer:         $url"
Write-Host "    On a phone (same Wi-Fi):  http://${lanIp}:$port"
Write-Host ''
Write-Host '    Student:  10a-01 / Student@2026      Teacher:  teacher.reem / Teacher@2026'
Write-Host '    (all sample accounts are listed in README.md)'
Write-Host ''
Write-Host '    Stop:  run.cmd --stop      Fresh data:  run.cmd --reset      Log:  docker compose logs -f app'
Write-Host ''
if (-not $env:TQ_NO_BROWSER) { Start-Process $url }
