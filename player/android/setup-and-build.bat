@echo off
echo ========================================
echo JAVA SETUP AND GRADLE BUILD SCRIPT
echo ========================================
echo.

REM Use Java from Downloads (correct path)
set JAVA_HOME=C:\Users\Sanket\Downloads\OpenJDK21U-jdk_x64_windows_hotspot_21.0.10_7\jdk-21.0.10
set PATH=%JAVA_HOME%\bin;%PATH%

echo Step 1: Verifying Java...
if not exist "%JAVA_HOME%\bin\java.exe" (
    echo Java not found at %JAVA_HOME%
    echo Please ensure JDK is extracted correctly.
    goto :end
)

"%JAVA_HOME%\bin\java.exe" -version
if %ERRORLEVEL% NEQ 0 (
    echo Java verification failed!
    goto :end
)

echo.
echo Step 2: Running Gradle Build...
cd /d "C:\Users\Sanket\Desktop\Me\Projects\Playground\PixelCCMSCopilot\practice\player\android"

echo.
echo Running: gradlew clean build --refresh-dependencies
call gradlew.bat clean build --refresh-dependencies

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo BUILD SUCCESSFUL!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo BUILD FAILED! Check errors above.
    echo ========================================
)

:end
echo.
echo Press any key to exit...
pause > nul


