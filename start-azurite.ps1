# Start Azurite Blob Storage Emulator

Write-Host "Starting Azurite Blob Storage Emulator..." -ForegroundColor Green

# Create azurite data directory if it doesn't exist
$azuriteDir = "C:\azurite"
if (-not (Test-Path $azuriteDir)) {
    New-Item -ItemType Directory -Path $azuriteDir | Out-Null
    Write-Host "Created Azurite data directory: $azuriteDir" -ForegroundColor Yellow
}

# Start Azurite
Write-Host "`nAzurite will store data in: $azuriteDir" -ForegroundColor Cyan
Write-Host "Blob endpoint: http://127.0.0.1:10000/devstoreaccount1" -ForegroundColor Cyan
Write-Host "`nPress Ctrl+C to stop Azurite`n" -ForegroundColor Yellow

azurite --silent --location $azuriteDir --debug "$azuriteDir\debug.log"
