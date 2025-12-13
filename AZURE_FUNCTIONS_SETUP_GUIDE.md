# Booking Status Update - Azure Functions Setup Guide

## Overview

This guide explains how to deploy the booking status update as an Azure Function, which runs as a serverless alternative to the in-app background service. The function uses the same core logic (`BookingStatusUpdateService`) but runs independently in Azure.

## Architecture

```
┌─────────────────────────────────────────────────┐
│           Booking Status Update Options         │
├─────────────────────────────────────────────────┤
│                                                 │
│  Option 1: Background Service (In-App)         │
│  - Runs inside CCMS.Api application            │
│  - Every 5 minutes (configurable)              │
│  - Enable in appsettings.json                  │
│                                                 │
│  Option 2: Azure Function (Serverless)         │
│  - Runs independently in Azure                 │
│  - Timer trigger (every 5 minutes)             │
│  - Better for scaling & reliability            │
│  - This guide focuses on this option           │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Prerequisites

- ✅ .NET 8 SDK installed
- ✅ Azure Functions Core Tools v4
- ✅ Azure account (for cloud deployment)
- ✅ Visual Studio Code (recommended)
- ✅ Azure Functions extension for VS Code

---

## Part 1: Local Development & Testing

### Step 1: Install Azure Functions Core Tools

```powershell
# Using winget (Windows)
winget install Microsoft.Azure.FunctionsCoreTools

# Or using npm
npm install -g azure-functions-core-tools@4 --unsafe-perm true

# Verify installation
func --version
```

### Step 2: Update Connection String

Edit `CCMS.Functions/local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated",
    "ConnectionStrings__DefaultConnection": "Server=(localdb)\\mssqllocaldb;Database=CCMSDb;Trusted_Connection=true;MultipleActiveResultSets=true",
    "BookingStatusUpdate__TimerSchedule": "0 */1 * * * *"
  }
}
```

**Connection String Format:**
- For LocalDB: `Server=(localdb)\\mssqllocaldb;Database=CCMSDb;Trusted_Connection=true;`
- For SQL Server: `Server=YOUR_SERVER;Database=CCMSDb;User Id=YOUR_USER;Password=YOUR_PASSWORD;`

### Step 3: Build the Function Project

```powershell
cd backend/CCMS.Functions

# Restore packages
dotnet restore

# Build
dotnet build

# Should output: Build succeeded
```

### Step 4: Run Locally

```powershell
# Start Azure Functions host
func start

# Or using dotnet
dotnet run
```

**Expected output:**
```
Functions:
    BookingStatusUpdateFunction: timerTrigger

Host started
```

### Step 5: Test Locally

The function runs automatically based on the timer (every 5 minutes). To test immediately:

```powershell
# Trigger manually via HTTP
curl http://localhost:7071/admin/functions/BookingStatusUpdateFunction

# Check logs in the console
# You should see: "Starting booking status update check at..."
```

### Step 6: Monitor Logs

Watch the console output for:
- ✅ "Found X bookings to check for status updates"
- ✅ "Booking X status updated: Approved → Active"
- ✅ "Successfully updated X booking(s)"

---

## Part 2: Cloud Deployment to Azure

### Step 1: Create Azure Resources

#### Option A: Using Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Click "Create a resource" → "Function App"
3. Fill in:
   - **Resource Group**: Create new or select existing
   - **Function App name**: `ccms-booking-status-func` (must be globally unique)
   - **Runtime stack**: .NET
   - **Version**: 8 (Isolated)
   - **Region**: Choose nearest region
   - **Operating System**: Windows or Linux
   - **Plan type**: Consumption (Serverless) - Pay per execution
4. Click "Review + Create" → "Create"

#### Option B: Using Azure CLI

```bash
# Login to Azure
az login

# Create resource group
az group create --name ccms-rg --location eastus

# Create storage account (required for Functions)
az storage account create \
  --name ccmsstorage123 \
  --resource-group ccms-rg \
  --location eastus \
  --sku Standard_LRS

# Create Function App
az functionapp create \
  --name ccms-booking-status-func \
  --resource-group ccms-rg \
  --consumption-plan-location eastus \
  --runtime dotnet-isolated \
  --runtime-version 8 \
  --functions-version 4 \
  --storage-account ccmsstorage123
```

### Step 2: Configure Application Settings

You need to add your database connection string to Azure:

#### Using Azure Portal:
1. Go to your Function App
2. Click "Configuration" → "Application settings"
3. Add new setting:
   - **Name**: `ConnectionStrings__DefaultConnection`
   - **Value**: `Server=YOUR_AZURE_SQL_SERVER;Database=CCMSDb;User Id=YOUR_USER;Password=YOUR_PASSWORD;`
4. Add timer schedule (optional):
   - **Name**: `BookingStatusUpdate__TimerSchedule`
   - **Value**: `0 */5 * * * *` (every 5 minutes)
5. Click "Save"

#### Using Azure CLI:
```bash
az functionapp config appsettings set \
  --name ccms-booking-status-func \
  --resource-group ccms-rg \
  --settings "ConnectionStrings__DefaultConnection=YOUR_CONNECTION_STRING"
```

### Step 3: Deploy to Azure

#### Option A: Using VS Code (Recommended)

1. Install "Azure Functions" extension in VS Code
2. Open `backend/CCMS.Functions` folder
3. Click Azure icon in sidebar
4. Sign in to Azure
5. Click "Deploy to Function App" icon
6. Select your Function App
7. Confirm deployment

#### Option B: Using Azure Functions Core Tools

```powershell
cd backend/CCMS.Functions

# Publish to Azure
func azure functionapp publish ccms-booking-status-func
```

#### Option C: Using dotnet CLI

```powershell
cd backend/CCMS.Functions

# Build in Release mode
dotnet build --configuration Release

# Publish
dotnet publish --configuration Release --output ./publish

# Deploy using Azure CLI
cd publish
func azure functionapp publish ccms-booking-status-func
```

### Step 4: Verify Deployment

1. Go to Azure Portal → Your Function App
2. Click "Functions" → You should see `BookingStatusUpdateFunction`
3. Click on it → "Monitor" → Check execution logs
4. You should see runs every 5 minutes

### Step 5: Monitor & Logs

#### Using Azure Portal:
- Function App → "Log stream" (real-time logs)
- Function App → "Application Insights" (detailed telemetry)

#### Using Azure CLI:
```bash
# Stream logs
az webapp log tail \
  --name ccms-booking-status-func \
  --resource-group ccms-rg
```

---

## Part 3: Configuration & Switching

### How to Switch Between Background Service and Azure Function

#### Disable Background Service (Use Azure Function Instead)

Edit `backend/CCMS.Api/appsettings.json`:

```json
{
  "BookingStatusUpdate": {
    "BackgroundService": {
      "Enabled": false,    // ← Disable this
      "IntervalMinutes": 5
    },
    "ServerlessFunction": {
      "Enabled": true,     // ← Enable this
      "Comment": "Azure Function is handling booking status updates"
    }
  }
}
```

#### Enable Background Service (Disable Azure Function)

```json
{
  "BookingStatusUpdate": {
    "BackgroundService": {
      "Enabled": true,     // ← Enable this
      "IntervalMinutes": 5
    },
    "ServerlessFunction": {
      "Enabled": false,    // ← Disable this
      "Comment": "In-app background service is handling updates"
    }
  }
}
```

### Adjust Timer Schedule

The function runs on a cron schedule. Default is every 5 minutes: `0 */5 * * * *`

**Common schedules:**
- Every 1 minute: `0 */1 * * * *`
- Every 10 minutes: `0 */10 * * * *`
- Every hour: `0 0 * * * *`
- Every day at 2 AM: `0 0 2 * * *`

Edit in:
- **Local**: `CCMS.Functions/local.settings.json`
- **Azure**: Function App → Configuration → App Settings

---

## Part 4: Troubleshooting

### Issue: "Build failed" when running locally

**Solution:**
```powershell
# Clean and rebuild
dotnet clean
dotnet restore
dotnet build
```

### Issue: "Connection string not found"

**Solution:**
Ensure `local.settings.json` has:
```json
{
  "Values": {
    "ConnectionStrings__DefaultConnection": "YOUR_CONNECTION_STRING"
  }
}
```

Note: Use double underscores `__` to represent nested JSON.

### Issue: Function not triggering in Azure

**Solution:**
1. Check Function App → Monitor → Invocations
2. Verify timer schedule in Application Settings
3. Check if Function App is running (not stopped)
4. Look at Log Stream for errors

### Issue: Database connection fails in Azure

**Solution:**
1. Ensure Azure SQL allows connections from Azure Services
2. Check firewall rules in Azure SQL
3. Verify connection string is correct
4. Test connection using SQL Server Management Studio

---

## Part 5: Cost Estimation

### Azure Function Consumption Plan

**Pricing (as of 2024):**
- **Execution**: $0.20 per million executions
- **Execution time**: $0.000016 per GB-s

**Example calculation:**
- Runs every 5 minutes = 288 executions/day = 8,640/month
- Execution time: ~2 seconds
- Memory: 128 MB

**Monthly cost:** ~$0.01 (essentially free under free tier)

**Free tier includes:**
- 1 million executions
- 400,000 GB-s of execution time

**Conclusion:** For this use case, you'll likely stay within the free tier!

---

## Part 6: Best Practices

### 1. Use Application Insights

Enable detailed monitoring:
```bash
# Create Application Insights
az monitor app-insights component create \
  --app ccms-func-insights \
  --location eastus \
  --resource-group ccms-rg

# Link to Function App
az functionapp config appsettings set \
  --name ccms-booking-status-func \
  --resource-group ccms-rg \
  --settings "APPINSIGHTS_INSTRUMENTATIONKEY=YOUR_KEY"
```

### 2. Use Key Vault for Secrets

Store connection strings securely:
```bash
# Create Key Vault
az keyvault create \
  --name ccms-keyvault \
  --resource-group ccms-rg

# Add secret
az keyvault secret set \
  --vault-name ccms-keyvault \
  --name "DatabaseConnectionString" \
  --value "YOUR_CONNECTION_STRING"

# Reference in Function App
# Use: @Microsoft.KeyVault(SecretUri=https://ccms-keyvault.vault.azure.net/secrets/DatabaseConnectionString/)
```

### 3. Enable Deployment Slots

For zero-downtime deployments:
- Production slot
- Staging slot (for testing)
- Swap when ready

### 4. Set up CI/CD

Use GitHub Actions or Azure DevOps for automated deployments.

---

## Part 7: Comparison Table

| Feature | Background Service | Azure Function |
|---------|-------------------|----------------|
| **Hosting** | Inside CCMS.Api | Separate serverless |
| **Scaling** | Limited to app instances | Auto-scales infinitely |
| **Cost** | Included in app hosting | Pay per execution (~free) |
| **Reliability** | Depends on app uptime | High (Azure managed) |
| **Monitoring** | App logs | App Insights + Portal |
| **Code Sharing** | ✅ Same `BookingStatusUpdateService` | ✅ Same `BookingStatusUpdateService` |
| **Setup Complexity** | Low | Medium |
| **Best For** | Small-medium loads | Production at scale |

---

## Quick Start Commands

```powershell
# 1. Install tools
winget install Microsoft.Azure.FunctionsCoreTools

# 2. Navigate to function project
cd backend/CCMS.Functions

# 3. Update local.settings.json with your connection string

# 4. Run locally
func start

# 5. Deploy to Azure (after creating Function App)
func azure functionapp publish ccms-booking-status-func

# 6. Stream logs
func azure functionapp logstream ccms-booking-status-func
```

---

## Summary

✅ **Local Development**: Use `func start` to run and test locally  
✅ **Cloud Deployment**: Deploy to Azure Function App for production  
✅ **Automatic Updates**: Timer trigger runs every 5 minutes  
✅ **Cost Effective**: Likely free under Azure's free tier  
✅ **Reliable**: Azure-managed infrastructure  

The Azure Function shares the exact same logic as the background service (`BookingStatusUpdateService`), so you can switch between them anytime without code changes!
