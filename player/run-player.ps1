<#
.SYNOPSIS
    Build and run PixelSpot CCMS players (ChromeOS PWA and/or Android APK).

.DESCRIPTION
    Combined launcher script that can build/run either or both player platforms.
    Run without flags to see an interactive menu.

.PARAMETER ChromeOS
    Build and serve the ChromeOS player (PWA on port 3100).

.PARAMETER Android
    Build the Android player (debug APK).

.PARAMETER Both
    Build both players sequentially.

.PARAMETER Release
    (Android only) Build a release APK instead of debug.

.PARAMETER Install
    (Android only) Install APK on connected ADB device.

.PARAMETER BuildOnly
    (ChromeOS only) Build without serving.

.PARAMETER Port
    (ChromeOS only) Port to serve on (default: 3100).

.EXAMPLE
    .\run-player.ps1 -ChromeOS             # Build + serve ChromeOS player
    .\run-player.ps1 -Android              # Build Android debug APK
    .\run-player.ps1 -Android -Install     # Build + install on device
    .\run-player.ps1 -Both                 # Build both players
    .\run-player.ps1                       # Interactive menu
#>

param(
    [switch]$ChromeOS,
    [switch]$Android,
    [switch]$Both,
    [switch]$Release,
    [switch]$Install,
    [switch]$BuildOnly,
    [int]$Port = 3100
)

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  PixelSpot CCMS - Player Builder" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# ── Interactive menu if no flags ──
if (-not $ChromeOS -and -not $Android -and -not $Both) {
    Write-Host "  Which player do you want to build?" -ForegroundColor White
    Write-Host ""
    Write-Host '  1) ChromeOS Player  - PWA, runs in browser' -ForegroundColor Cyan
    Write-Host '  2) Android Player   - APK, runs on Android TV/phone' -ForegroundColor Cyan
    Write-Host '  3) Both             - build both sequentially' -ForegroundColor Cyan
    Write-Host '  Q) Quit' -ForegroundColor DarkGray
    Write-Host ""

    $choice = Read-Host '  Enter choice: 1, 2, 3, or Q'

    switch ($choice) {
        "1" { $ChromeOS = $true }
        "2" { $Android = $true }
        "3" { $Both = $true }
        "Q" { Write-Host "  Bye!" -ForegroundColor DarkGray; exit 0 }
        "q" { Write-Host "  Bye!" -ForegroundColor DarkGray; exit 0 }
        default {
            Write-Host "FAIL: Invalid choice: $choice" -ForegroundColor Red
            exit 1
        }
    }
}

if ($Both) {
    $ChromeOS = $true
    $Android = $true
}

$exitCode = 0

# ── ChromeOS Player ──
if ($ChromeOS) {
    $chromeScript = Join-Path $ScriptDir "run-chromeos.ps1"
    if (-not (Test-Path $chromeScript)) {
        Write-Host "FAIL: run-chromeos.ps1 not found at: $chromeScript" -ForegroundColor Red
        $exitCode = 1
    } else {
        $chromeParams = @{}
        if ($BuildOnly -or $Android) {
            # If also building Android, don't start the server (it blocks)
            $chromeParams['Build'] = $true
        }
        if ($Port -ne 3100) {
            $chromeParams['Port'] = $Port
        }

        & $chromeScript @chromeParams
        if ($LASTEXITCODE -ne 0) {
            Write-Host "FAIL: ChromeOS player build failed." -ForegroundColor Red
            $exitCode = 1
        }
    }
}

# ── Android Player ──
if ($Android) {
    $androidScript = Join-Path $ScriptDir "run-android.ps1"
    if (-not (Test-Path $androidScript)) {
        Write-Host "FAIL: run-android.ps1 not found at: $androidScript" -ForegroundColor Red
        $exitCode = 1
    } else {
        $androidParams = @{}
        if ($Release) { $androidParams['Release'] = $true }
        if ($Install) { $androidParams['Install'] = $true }

        & $androidScript @androidParams
        if ($LASTEXITCODE -ne 0) {
            Write-Host "FAIL: Android player build failed." -ForegroundColor Red
            $exitCode = 1
        }
    }
}

# ── Summary ──
Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  Build Summary" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

if ($ChromeOS) {
    $distExists = Test-Path (Join-Path $ScriptDir 'chromeos\dist')
    $status = if ($distExists) { 'OK' } else { 'FAIL' }
    $color = if ($distExists) { 'Green' } else { 'Red' }
    $label = '  ChromeOS: ' + $status + '  -  player/chromeos/dist/'
    Write-Host $label -ForegroundColor $color
}

if ($Android) {
    $apkPath = Join-Path $ScriptDir 'android\output'
    $apkExists = (Test-Path $apkPath) -and (Get-ChildItem $apkPath -Filter '*.apk' -ErrorAction SilentlyContinue)
    $status = if ($apkExists) { 'OK' } else { 'FAIL' }
    $color = if ($apkExists) { 'Green' } else { 'Red' }
    $label = '  Android:  ' + $status + '  -  player/android/output/'
    Write-Host $label -ForegroundColor $color
}

Write-Host ""
exit $exitCode
