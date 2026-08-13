# CCMS Azure Functions

This project contains Azure Functions for the PixelCCMS system that can be used as an alternative to background services for serverless deployments.

## Functions

### BookingStatusUpdateFunction

Timer-triggered function that updates booking statuses based on dates and screen operating schedules.

- **Schedule**: Every 5 minutes (configurable via cron expression in the function)
- **Purpose**: Transitions bookings from Approved → Active → Completed based on current time and screen operating hours

## Configuration

### Local Development

Update `local.settings.json` with your database connection string:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Your connection string here"
  }
}
```

### Azure Deployment

Set the following application settings in Azure:

- `ConnectionStrings__DefaultConnection`: Your production database connection string
- `FUNCTIONS_WORKER_RUNTIME`: `dotnet-isolated`
- `AzureWebJobsStorage`: Your Azure Storage connection string

## Changing the Schedule

To adjust the function execution frequency, modify the cron expression in `BookingStatusUpdateFunction.cs`:

```csharp
[TimerTrigger("0 */5 * * * *")] // Current: Every 5 minutes
```

Common cron expressions:
- Every minute: `"0 * * * * *"`
- Every 2 minutes: `"0 */2 * * * *"`
- Every 10 minutes: `"0 */10 * * * *"`
- Every hour: `"0 0 * * * *"`

Format: `"seconds minutes hours day month day-of-week"`

## Switching Between Background Service and Azure Function

In the main API's `appsettings.json`:

```json
{
  "BookingStatusUpdate": {
    "BackgroundService": {
      "Enabled": false  // Disable when using Azure Function
    }
  }
}
```

**Important**: Only enable ONE of these at a time to avoid duplicate updates:
- Background Service (in CCMS.Api) for monolithic deployments
- Azure Function (CCMS.Functions) for serverless deployments
