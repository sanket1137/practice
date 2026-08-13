# Gradle Sync Script for Android Project
# This PowerShell script performs gradle sync with automatic Java setup

param(
    [switch]$SkipJavaCheck = $false,
    [switch]$Verbose = $false
)

# Configuration
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$gradlewBat = Join-Path $projectRoot "gradlew.bat"
$gradleWrapperProps = Join-Path $projectRoot "gradle\wrapper\gradle-wrapper.properties"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Gradle Sync - Android Project" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Function to find Java
function Find-Java {
    Write-Host "Searching for Java installation..." -ForegroundColor Yellow

    $javaLocations = @(
        "C:\Program Files\Eclipse Adoptium",
        "C:\Program Files\Java",
        "C:\Program Files (x86)\Java",
        "$env:ProgramFiles\Eclipse Adoptium",
        $env:JAVA_HOME
    )

    foreach ($location in $javaLocations) {
        $javaExe = Join-Path $location "bin\java.exe"
        if (Test-Path $javaExe) {
            Write-Host "✓ Found Java at: $location" -ForegroundColor Green
            return $location
        }
    }

    # Try java in PATH
    try {
        $javaVersion = & java -version 2>&1 | Select-Object -First 1
        if ($javaVersion) {
            Write-Host "✓ Found Java in PATH: $javaVersion" -ForegroundColor Green
            return $null
        }
    }
    catch {
        # Java not found
    }

    return $null
}

# Function to display gradle properties
function Show-GradleInfo {
    if (Test-Path $gradleWrapperProps) {
        Write-Host "`nGradle Configuration:" -ForegroundColor Cyan
Get-Content $gradleWrapperProps | Where-Object { $_ -match '=' } | ForEach-Object {
    Write-Host "  $_"
}
    }
}

# Main execution
if (-not $SkipJavaCheck) {
    $javaHome = Find-Java

    if (-not $javaHome -and -not (Test-Path env:JAVA_HOME)) {
        Write-Host "`n✗ Error: Java not found!" -ForegroundColor Red
        Write-Host "`nPlease install Java from one of these sources:" -ForegroundColor Yellow
        Write-Host "  • Eclipse Adoptium: https://adoptium.net/" -ForegroundColor White
        Write-Host "  • Oracle Java: https://www.oracle.com/java/technologies/downloads/" -ForegroundColor White
        Write-Host "  • Microsoft OpenJDK: https://microsoft.com/openjdk" -ForegroundColor White
        Write-Host "`nAfter installation, run this script again.`n" -ForegroundColor Yellow
        exit 1
    }

    if ($javaHome) {
        $env:JAVA_HOME = $javaHome
        $env:Path = "$javaHome\bin;$env:Path"
    }
}

# Display gradle configuration
Show-GradleInfo

# Run gradle sync
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Running Gradle Sync" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Push-Location $projectRoot

$arguments = @("clean", "build", "--refresh-dependencies")
if ($Verbose) {
    $arguments += "--stacktrace"
}

Write-Host "Command: .\gradlew.bat $($arguments -join ' ')`n" -ForegroundColor Gray

& $gradlewBat @arguments

$exitCode = $LASTEXITCODE

Pop-Location

# Display results
Write-Host "`n========================================" -ForegroundColor Cyan
if ($exitCode -eq 0) {
    Write-Host "Gradle Sync Completed Successfully!" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "Gradle Sync Failed!" -ForegroundColor Red
    Write-Host "========================================`n" -ForegroundColor Cyan
    Write-Host "For troubleshooting, run with -Verbose flag:" -ForegroundColor Yellow
    Write-Host "  powershell -File gradle-sync.ps1 -Verbose" -ForegroundColor Gray
    exit $exitCode
}



