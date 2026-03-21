<#
.SYNOPSIS
    Build and serve the PixelSpot CCMS ChromeOS Player (PWA).

.DESCRIPTION
    Installs dependencies, builds the Vite project, and serves it locally on port 3100.
    The built dist/ folder can be deployed to any static host (Vercel, Netlify, Nginx).

.PARAMETER Build
    Build only — skip serving.

.PARAMETER Serve
    Serve existing dist/ folder — skip build.

.PARAMETER Port
    Port to serve on (default: 3100).

.EXAMPLE
    .\run-chromeos.ps1              # Build + serve
    .\run-chromeos.ps1 -Build       # Build only (produces dist/)
    .\run-chromeos.ps1 -Serve       # Serve existing dist/
    .\run-chromeos.ps1 -Port 8080   # Serve on custom port
#>

param(
    [switch]$Build,
    [switch]$Serve,
    [int]$Port = 3100
)

$ErrorActionPreference = "Stop"
$PlayerDir = Join-Path $PSScriptRoot "chromeos"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PixelSpot CCMS - ChromeOS Player" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Check Node.js ──
$nodeVersion = $null
try { $nodeVersion = (node --version 2>$null) } catch {}

if (-not $nodeVersion) {
    Write-Host "FAIL: Node.js is not installed or not in PATH." -ForegroundColor Red
    Write-Host "      Download from: https://nodejs.org/ (LTS recommended)" -ForegroundColor Yellow
    exit 1
}
Write-Host "OK: Node.js $nodeVersion" -ForegroundColor Green

# ── Check npm ──
$npmVersion = $null
try { $npmVersion = (npm --version 2>$null) } catch {}

if (-not $npmVersion) {
    Write-Host "FAIL: npm is not available." -ForegroundColor Red
    exit 1
}
Write-Host "OK: npm v$npmVersion" -ForegroundColor Green

# ── Navigate to project ──
if (-not (Test-Path $PlayerDir)) {
    Write-Host "FAIL: ChromeOS player directory not found: $PlayerDir" -ForegroundColor Red
    exit 1
}

Push-Location $PlayerDir
try {
    # ── Determine mode ──
    $doBuild = (-not $Serve) -or $Build
    $doServe = (-not $Build) -or $Serve

    # ── Install + Build ──
    if ($doBuild) {
        Write-Host ""
        Write-Host "Step 1/2: Installing dependencies..." -ForegroundColor Yellow
        npm install 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "FAIL: npm install failed." -ForegroundColor Red
            exit 1
        }
        Write-Host "OK: Dependencies installed." -ForegroundColor Green

        Write-Host ""
        Write-Host "Step 2/2: Building for production..." -ForegroundColor Yellow
        npm run build 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "FAIL: Build failed." -ForegroundColor Red
            exit 1
        }

        $distPath = Join-Path $PlayerDir "dist"
        Write-Host "OK: Build complete -> $distPath" -ForegroundColor Green
        Write-Host ""
        Write-Host "  To share with friends remotely:" -ForegroundColor DarkCyan
        Write-Host "    1. Deploy the dist/ folder to Vercel:  npx vercel dist/" -ForegroundColor DarkCyan
        Write-Host "    2. Or Netlify:  npx netlify deploy --dir=dist --prod" -ForegroundColor DarkCyan
        Write-Host "    3. Or any static web host / Nginx server" -ForegroundColor DarkCyan
    }

    # ── Serve ──
    if ($doServe) {
        $distPath = Join-Path $PlayerDir "dist"
        if (-not (Test-Path $distPath)) {
            Write-Host "FAIL: dist/ folder not found. Run with -Build first." -ForegroundColor Red
            exit 1
        }

        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  Serving ChromeOS Player" -ForegroundColor Green
        Write-Host "  URL: http://localhost:$Port" -ForegroundColor White
        Write-Host "  Press Ctrl+C to stop" -ForegroundColor DarkGray
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Friends on the same network can access:" -ForegroundColor DarkCyan

        # Get local IP for LAN sharing
        $localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback" -and $_.PrefixOrigin -eq "Dhcp" } | Select-Object -First 1).IPAddress
        if ($localIP) {
            Write-Host "  http://${localIP}:$Port" -ForegroundColor White
        }
        Write-Host ""

        npx vite preview --port $Port --host
    }
}
finally {
    Pop-Location
}
