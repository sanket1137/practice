# Setup Script
Write-Host "Installing EF Core tools..."
dotnet tool install --global dotnet-ef

Write-Host "Restoring Backend..."
dotnet restore

Write-Host "Updating Database..."
dotnet ef database update --project backend/CCMS.Infrastructure --startup-project backend/CCMS.Api

Write-Host "Installing Frontend Dependencies..."
cd frontend
npm install
cd ..

Write-Host "Setup Complete! Run start-all.ps1 to launch the application."
