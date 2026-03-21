@echo off
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set PATH=%JAVA_HOME%\bin;%PATH%

echo JAVA_HOME=%JAVA_HOME%
echo.
echo Building...
call gradlew.bat assembleDebug

echo.
echo Build complete. Installing APK...
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
"%ANDROID_HOME%\platform-tools\adb.exe" -s emulator-5554 install -r app\build\outputs\apk\debug\app-debug.apk

echo.
echo Restarting app...
"%ANDROID_HOME%\platform-tools\adb.exe" -s emulator-5554 shell am force-stop com.pixelspot.ccms.player.debug
"%ANDROID_HOME%\platform-tools\adb.exe" -s emulator-5554 shell am start -n com.pixelspot.ccms.player.debug/com.pixelspot.ccms.player.MainActivity

echo Done!
pause

