[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 10110,

    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$ProjectDirectory = $PSScriptRoot
$Url = "http://localhost:$Port/"

function Test-PrototypeServer {
    param([string]$TargetUrl)

    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $TargetUrl -TimeoutSec 5
        return $response.StatusCode -eq 200 -and $response.Content -match "<title>BMS"
    }
    catch {
        return $false
    }
}

function Open-PrototypeBrowser {
    param([string]$TargetUrl)

    if (-not $NoBrowser) {
        Start-Process $TargetUrl
    }
}

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) {
    throw "Node.js was not found. Install Node.js and try again."
}

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) {
    throw "npm was not found. Check the Node.js installation."
}

if (Test-PrototypeServer -TargetUrl $Url) {
    Write-Host "[INFO] The prototype is already running at $Url" -ForegroundColor Green
    Open-PrototypeBrowser -TargetUrl $Url
    exit 0
}

$listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
if ($listeners.Count -gt 0) {
    $processes = $listeners |
        ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue } |
        Select-Object -Unique Id, ProcessName

    Write-Host "[ERROR] Port $Port is already used by another program." -ForegroundColor Red
    $processes | Format-Table -AutoSize
    exit 1
}

$viteCommand = Join-Path $ProjectDirectory "node_modules\.bin\vite.cmd"
if (-not (Test-Path -LiteralPath $viteCommand)) {
    Write-Host "[INFO] Installing project dependencies for the first run..." -ForegroundColor Cyan
    Push-Location $ProjectDirectory
    try {
        & $npm.Source install
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to install project dependencies."
        }
    }
    finally {
        Pop-Location
    }
}

$browserJob = $null
if (-not $NoBrowser) {
    $browserJob = Start-Job -ScriptBlock {
        param($TargetUrl)

        $deadline = (Get-Date).AddSeconds(60)
        do {
            try {
                $response = Invoke-WebRequest -UseBasicParsing -Uri $TargetUrl -TimeoutSec 5
                if ($response.StatusCode -eq 200) {
                    Start-Process $TargetUrl
                    return
                }
            }
            catch {
            }

            Start-Sleep -Milliseconds 500
        } while ((Get-Date) -lt $deadline)
    } -ArgumentList $Url
}

Write-Host "[INFO] Starting the billing prototype at $Url" -ForegroundColor Cyan
Write-Host "[INFO] Press Ctrl+C to stop the server." -ForegroundColor DarkGray

$exitCode = 0
Push-Location $ProjectDirectory
try {
    & $npm.Source run dev -- --port $Port
    $exitCode = $LASTEXITCODE
}
finally {
    Pop-Location

    if ($browserJob) {
        Stop-Job -Job $browserJob -ErrorAction SilentlyContinue
        Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue
    }
}

if ($exitCode -ne 0) {
    Write-Host "[ERROR] The prototype server exited with code $exitCode." -ForegroundColor Red
}

exit $exitCode
