@echo off
echo ========================================
echo FIXING GRADLE WRAPPER AND BUILDING
echo ========================================
echo.

REM Set Java
set JAVA_HOME=C:\Users\Sanket\Downloads\OpenJDK21U-jdk_x64_windows_hotspot_21.0.10_7\jdk-21.0.10
set PATH=%JAVA_HOME%\bin;%PATH%

echo Step 1: Verifying Java...
"%JAVA_HOME%\bin\java.exe" -version
if %ERRORLEVEL% NEQ 0 (
    echo Java verification failed!
    goto :end
)

cd /d "C:\Users\Sanket\Desktop\Me\Projects\Playground\PixelCCMSCopilot\practice\player\android"

echo.
echo Step 2: Downloading fresh Gradle Wrapper JAR...
REM Delete old corrupted jar
del /f /q "gradle\wrapper\gradle-wrapper.jar" 2>nul

REM Use curl to download the wrapper jar (more reliable than PowerShell)
curl -L -o "gradle\wrapper\gradle-wrapper.jar" "https://github.com/gradle/gradle/raw/v8.5.0/gradle/wrapper/gradle-wrapper.jar"

if not exist "gradle\wrapper\gradle-wrapper.jar" (
    echo Failed to download gradle-wrapper.jar
    echo Trying alternative method...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://github.com/gradle/gradle/raw/v8.5.0/gradle/wrapper/gradle-wrapper.jar', 'gradle\wrapper\gradle-wrapper.jar')"
)

echo.
echo Step 3: Running Gradle Sync...
call gradlew.bat --version

if %ERRORLEVEL% NEQ 0 (
    echo Gradle wrapper still not working.
    echo Trying to run build anyway...
)

echo.
echo Step 4: Building Project...
call gradlew.bat clean build --stacktrace

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo BUILD SUCCESSFUL!
    echo APK Location: app\build\outputs\apk\
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

