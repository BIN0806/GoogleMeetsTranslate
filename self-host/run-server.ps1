param()

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker is required. Install Docker Desktop and try again."
  exit 1
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

for ($port = 5000; $port -le 5050; $port++) {
    $inUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if (-not $inUse) {
        $env:HOST_PORT = $port
        Write-Host "Starting LibreTranslate server (http://localhost:$port/translate)..."
        docker compose up
        exit $LASTEXITCODE
    }
}

Write-Error "No free port found between 5000 and 5050."
exit 1

