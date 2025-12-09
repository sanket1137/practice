# Start Azure Storage Emulator

Write-Host "`n🔷 Starting Azure Storage Emulator..." -ForegroundColor Cyan

$emulatorPath = "C:\Program Files (x86)\Microsoft SDKs\Azure\Storage Emulator\AzureStorageEmulator.exe"

if (Test-Path $emulatorPath) {
    & $emulatorPath start
    
    Write-Host "`n✅ Azure Storage Emulator Started!" -ForegroundColor Green
    Write-Host "`n📊 Connection Details:" -ForegroundColor Yellow
    Write-Host "   Connection String: UseDevelopmentStorage=true" -ForegroundColor White
    Write-Host "   Blob Endpoint: http://127.0.0.1:10000/devstoreaccount1" -ForegroundColor White
    Write-Host "   Container Name: creatives" -ForegroundColor White
    
    Write-Host "`n🎯 Next Steps:" -ForegroundColor Yellow
    Write-Host "   1. Open Azure Storage Explorer" -ForegroundColor White
    Write-Host "   2. Connect with: UseDevelopmentStorage=true" -ForegroundColor White
    Write-Host "   3. Navigate to: Blob Containers → creatives" -ForegroundColor White
    Write-Host "   4. Upload a file via Swagger to see it appear!`n" -ForegroundColor White
} else {
    Write-Host "`n❌ Azure Storage Emulator not found at: $emulatorPath" -ForegroundColor Red
    Write-Host "   Please install it from:" -ForegroundColor Yellow
    Write-Host "   https://go.microsoft.com/fwlink/?linkid=717179`n" -ForegroundColor Cyan
}
