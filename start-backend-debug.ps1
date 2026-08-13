Write-Host "Starting CCMS Backend..." -ForegroundColor Green

cd backend\CCMS.Api
dotnet run --no-build 2&gt;error.txt
