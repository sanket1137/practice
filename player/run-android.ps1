<#
.SYNOPSIS
    Build the PixelSpot CCMS Android Player APK.

.DESCRIPTION
    Validates prerequisites (JDK 17+, Android SDK), builds the debug or release APK,
    copies it to an easy-to-find output/ folder, and optionally installs on a connected device.

.PARAMETER Release
    Build a release APK (minified + shrunk) instead of debug.

.PARAMETER Install
    Auto-install on connected ADB device after building.

.PARAMETER Clean
    Run a clean build (gradlew clean before assembling).

.EXAMPLE
    .\run-android.ps1                   # Debug build
    .\run-android.ps1 -Release          # Release build (unsigned, minified)
    .\run-android.ps1 -Install          # Debug build + install on device
    .\run-android.ps1 -Clean -Install   # Clean debug build + install
#>

param(
    [switch]$Release,
    [switch]$Install,
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
$PlayerDir = Join-Path $PSScriptRoot "android"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PixelSpot CCMS - Android Player" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Check JDK 17+ ──
$javaVersion = $null
$javaCmd = "java"

function Get-JavaMajorVersion($cmd) {
    try {
        $oldPref = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $output = & $cmd -version 2>&1 | Out-String
        $ErrorActionPreference = $oldPref
        if ($output -match '"(\d+)[\._]') {
            return [int]$Matches[1]
        }
    } catch {}
    return $null
}

# Try java on PATH first
$javaVersion = Get-JavaMajorVersion "java"

# Fall back to JAVA_HOME/bin/java
if (-not $javaVersion -and $env:JAVA_HOME) {
    $javaHomeBin = Join-Path $env:JAVA_HOME "bin\java.exe"
    if (Test-Path $javaHomeBin) {
        $javaCmd = $javaHomeBin
        $javaVersion = Get-JavaMajorVersion $javaCmd
    }
}

if (-not $javaVersion -or $javaVersion -lt 17) {
    Write-Host "FAIL: JDK 17 or higher is required." -ForegroundColor Red
    $currentJdk = if ($javaVersion) { "JDK $javaVersion" } else { "not found" }
    Write-Host "      Current: $currentJdk" -ForegroundColor Yellow
    Write-Host "      Download from: https://adoptium.net/ (Temurin JDK 17 or 21)" -ForegroundColor Yellow
    exit 1
}
Write-Host "OK: JDK $javaVersion" -ForegroundColor Green

# ── Check ANDROID_HOME ──
$androidHome = $env:ANDROID_HOME
if (-not $androidHome) {
    $androidHome = $env:ANDROID_SDK_ROOT
}
if (-not $androidHome) {
    # Common default locations
    $defaultPaths = @(
        "$env:LOCALAPPDATA\Android\Sdk",
        "$env:USERPROFILE\AppData\Local\Android\Sdk",
        "C:\Android\Sdk"
    )
    foreach ($p in $defaultPaths) {
        if (Test-Path $p) {
            $androidHome = $p
            break
        }
    }
}

if (-not $androidHome -or -not (Test-Path $androidHome)) {
    Write-Host "FAIL: Android SDK not found." -ForegroundColor Red
    Write-Host "      Set ANDROID_HOME environment variable or install Android Studio." -ForegroundColor Yellow
    Write-Host "      Download from: https://developer.android.com/studio" -ForegroundColor Yellow
    exit 1
}
Write-Host "OK: Android SDK at $androidHome" -ForegroundColor Green

# ── Navigate to project ──
if (-not (Test-Path $PlayerDir)) {
    Write-Host "FAIL: Android player directory not found: $PlayerDir" -ForegroundColor Red
    exit 1
}

Push-Location $PlayerDir
try {
    # ── Ensure local.properties exists ──
    $localPropsPath = Join-Path $PlayerDir "local.properties"
    if (-not (Test-Path $localPropsPath)) {
        Write-Host "INFO: Creating local.properties with SDK path..." -ForegroundColor Yellow
        $escapedPath = $androidHome -replace '\\', '\\\\'
        "sdk.dir=$escapedPath" | Set-Content -Path $localPropsPath -Encoding UTF8
        Write-Host "OK: local.properties created." -ForegroundColor Green
    }

    # ── Gradle wrapper ──
    $gradlew = Join-Path $PlayerDir "gradlew.bat"
    if (-not (Test-Path $gradlew)) {
        Write-Host "FAIL: gradlew.bat not found in $PlayerDir" -ForegroundColor Red
        exit 1
    }

    # ── Build ──
    # Ensure JAVA_HOME is set for Gradle
    if ($env:JAVA_HOME) {
        $env:JAVA_HOME = $env:JAVA_HOME
    } elseif ($javaCmd -ne "java") {
        # javaCmd points to JAVA_HOME/bin/java.exe — derive JAVA_HOME
        $env:JAVA_HOME = Split-Path (Split-Path $javaCmd)
    }

    $buildType = if ($Release) { "Release" } else { "Debug" }
    $assembleTask = "assemble$buildType"

    if ($Clean) {
        Write-Host ""
        Write-Host "Step 1/3: Cleaning previous build..." -ForegroundColor Yellow
        $ErrorActionPreference = "Continue"
        & $gradlew clean 2>&1
        $ErrorActionPreference = "Stop"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "WARN: Clean had issues, continuing..." -ForegroundColor Yellow
        }
        Write-Host "OK: Clean complete." -ForegroundColor Green
        $buildStep = "Step 2/3"
    } else {
        $buildStep = "Step 1/2"
    }

    Write-Host ""
    Write-Host "${buildStep}: Building $buildType APK..." -ForegroundColor Yellow
    Write-Host "      This may take a few minutes on first run (downloading dependencies)." -ForegroundColor DarkGray
    Write-Host ""

    $ErrorActionPreference = "Continue"
    & $gradlew $assembleTask 2>&1
    $ErrorActionPreference = "Stop"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAIL: Build failed. Check the output above for details." -ForegroundColor Red
        exit 1
    }
    Write-Host "OK: Build succeeded." -ForegroundColor Green

    # ── Copy APK to output/ ──
    $buildTypeLC = $buildType.ToLower()
    $apkSource = Join-Path $PlayerDir "app\build\outputs\apk\$buildTypeLC\app-$buildTypeLC.apk"
    $outputDir = Join-Path $PlayerDir "output"
    $apkDest = Join-Path $outputDir "PixelSpot-Player-$buildType.apk"

    if (-not (Test-Path $apkSource)) {
        Write-Host "WARN: APK not found at expected path: $apkSource" -ForegroundColor Yellow
        # Try to find it
        $foundApk = Get-ChildItem -Path (Join-Path $PlayerDir "app\build\outputs\apk") -Recurse -Filter "*.apk" | Select-Object -First 1
        if ($foundApk) {
            $apkSource = $foundApk.FullName
            Write-Host "      Found APK at: $apkSource" -ForegroundColor Yellow
        } else {
            Write-Host "FAIL: Could not find built APK." -ForegroundColor Red
            exit 1
        }
    }

    if (-not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    }
    Copy-Item -Path $apkSource -Destination $apkDest -Force

    $apkSize = [math]::Round((Get-Item $apkDest).Length / 1MB, 1)

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  APK Ready!" -ForegroundColor Green
    Write-Host "  Path: $apkDest" -ForegroundColor White
    Write-Host "  Size: ${apkSize} MB" -ForegroundColor White
    Write-Host "  Type: $buildType" -ForegroundColor White
    Write-Host "========================================" -ForegroundColor Green

    # ── Install on device ──
    if ($Install) {
        $lastStep = if ($Clean) { "Step 3/3" } else { "Step 2/2" }
        Write-Host ""
        Write-Host "${lastStep}: Installing on connected device..." -ForegroundColor Yellow

        $adbPath = $null
        try { $adbPath = (Get-Command adb -ErrorAction SilentlyContinue).Source } catch {}
        if (-not $adbPath) {
            $adbPath = Join-Path $androidHome "platform-tools\adb.exe"
        }

        if (-not (Test-Path $adbPath)) {
            Write-Host "FAIL: adb not found. Ensure Android SDK Platform-Tools are installed." -ForegroundColor Red
            Write-Host "      Install via: sdkmanager 'platform-tools'" -ForegroundColor Yellow
        } else {
            $ErrorActionPreference = "Continue"
            $devices = & $adbPath devices 2>&1 | Select-String "device$"
            $ErrorActionPreference = "Stop"
            if (-not $devices) {
                Write-Host "WARN: No ADB devices connected." -ForegroundColor Yellow
                Write-Host "      Connect your Android device via USB and enable USB debugging." -ForegroundColor DarkCyan
            } else {
                $ErrorActionPreference = "Continue"
                & $adbPath install -r $apkDest 2>&1
                $ErrorActionPreference = "Stop"
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "OK: Installed on device." -ForegroundColor Green
                } else {
                    Write-Host "FAIL: Installation failed. Check the output above." -ForegroundColor Red
                }
            }
        }
    }

    # ── Sharing instructions ──
    Write-Host ""
    Write-Host "  To share with friends:" -ForegroundColor DarkCyan
    Write-Host "    1. Send them: $apkDest" -ForegroundColor DarkCyan
    Write-Host "    2. They open it on their Android device/TV" -ForegroundColor DarkCyan
    Write-Host "    3. Enable 'Install from unknown sources' when prompted" -ForegroundColor DarkCyan
    Write-Host "    4. Open 'CCMS Player', enter Screen ID + API Key from dashboard" -ForegroundColor DarkCyan
    Write-Host ""
}
finally {
    Pop-Location
}
