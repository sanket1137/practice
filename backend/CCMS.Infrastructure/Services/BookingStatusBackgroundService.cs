using CCMS.Application.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CCMS.Infrastructure.Services;

/// <summary>
/// Background service that periodically updates booking statuses.
/// Can be enabled/disabled via configuration.
/// </summary>
public class BookingStatusBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<BookingStatusBackgroundService> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromMinutes(5);

    public BookingStatusBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<BookingStatusBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Booking status background service started. Running every {Interval} minutes.", 
            _interval.TotalMinutes);

        // Wait a bit before starting to allow the application to fully initialize
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await UpdateBookingStatusesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in booking status background service");
            }

            // Wait for the next interval
            try
            {
                await Task.Delay(_interval, stoppingToken);
            }
            catch (TaskCanceledException)
            {
                // Expected when the service is stopping
                break;
            }
        }

        _logger.LogInformation("Booking status background service stopped.");
    }

    private async Task UpdateBookingStatusesAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var bookingStatusService = scope.ServiceProvider.GetRequiredService<BookingStatusUpdateService>();

        try
        {
            var updatedCount = await bookingStatusService.UpdateBookingStatusesAsync(cancellationToken);
            
            if (updatedCount > 0)
            {
                _logger.LogInformation("Background service updated {Count} booking(s)", updatedCount);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating booking statuses in background service");
        }
    }
}
