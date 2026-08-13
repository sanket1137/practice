@echo off
REM Complete Gradle Sync Script
REM This script ensures Java is available and syncs gradle dependencies

setlocal enabledelayedexpansion

echo.
echo ========================================
echo Gradle Sync - Android Project Setup
echo ========================================
echo.

REM Try to find Java in common locations
set JAVA_FOUND=0

echo Searching for Java installation...

REM Check standard locations
for %%i in (
    "C:\Program Files\Eclipse Adoptium"
    "C:\Program Files\Java"
    "C:\Program Files (x86)\Java"
    "%ProgramFiles%\Eclipse Adoptium"
    "%JAVA_HOME%"
) do (
    if exist "%%~i\bin\java.exe" (
        set JAVA_HOME=%%~i
        set JAVA_FOUND=1
        echo Found Java at: %%~i
        goto setup_gradle
    )
)

:setup_gradle
echo.
echo ========================================
echo Setting up Gradle
echo ========================================
echo.

cd /d "%~dp0"

if !JAVA_FOUND! EQU 1 (
    echo Using Java from: !JAVA_HOME!
    set PATH=!JAVA_HOME!\bin;!PATH!
    set "GRADLE_OPTS=-Dorg.gradle.java.home=!JAVA_HOME!"
) else (
    echo Warning: Java not found in standard locations
    echo Attempting to run gradle anyway...
)

echo.
echo Running: gradlew.bat clean build --refresh-dependencies
echo.

call gradlew.bat clean build --refresh-dependencies

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo ✓ Gradle Sync Completed Successfully!
    echo ========================================
    echo.
) else (
    echo.
    echo ========================================
    echo ✗ Gradle Sync Failed!
    echo ========================================
    echo.
    echo If Java is not installed, please install it from:
    echo https://adoptium.net/
    echo.
)

pause


