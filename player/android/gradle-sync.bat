@echo off
REM This script syncs gradle dependencies for the Android project

setlocal enabledelayedexpansion

REM Set up paths
set GRADLE_HOME=C:\Users\Sanket\.gradle\wrapper\dists\gradle-8.5-bin\5t9huq95ubn472n8rpzujfbqh\gradle-8.5
set GRADLE_BIN=%GRADLE_HOME%\bin\gradle.bat

REM Check if gradle exists
if not exist "%GRADLE_BIN%" (
    echo Gradle binary not found at %GRADLE_BIN%
    exit /b 1
)

echo Starting gradle sync...
echo Gradle location: %GRADLE_BIN%

REM Run gradle sync
"%GRADLE_BIN%" clean build --refresh-dependencies

echo Gradle sync completed!

