using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using CCMS.Api.Hubs;

namespace CCMS.Api.Services;

/// <summary>
/// Background service that checks for expired access every minute
/// and immediately disconnects viewers who no longer have valid bookings.
/// </summary>
public class AccessRevocationBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<AccessRevocationBackgroundService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(1);
    
    private DateTime _lastCheckTime = DateTime.UtcNow;

    public AccessRevocationBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<AccessRevocationBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Access revocation background service started. Checking every {Interval} seconds.",
            _checkInterval.TotalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckAndRevokeExpiredAccessAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in access revocation background service");
            }

            await Task.Delay(_checkInterval, stoppingToken);
        }
    }

    private async Task CheckAndRevokeExpiredAccessAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<StreamingHub>>();
        var viewerManager = scope.ServiceProvider.GetRequiredService<ScreenViewerManager>();
        var accessService = scope.ServiceProvider.GetRequiredService<AdvertiserScreenAccessService>();

        var now = DateTime.UtcNow;
        var checkSince = _lastCheckTime;
        _lastCheckTime = now;

        // Find bookings that just ended
        var expiredAccess = await accessService.GetNewlyExpiredAccessAsync(checkSince);

        if (!expiredAccess.Any())
        {
            return;
        }

        _logger.LogInformation(
            "Found {Count} expired access entries to revoke",
            expiredAccess.Count);

        foreach (var expired in expiredAccess)
        {
            try
            {
                // Check if advertiser still has access via another booking
                var stillHasAccess = await accessService.CheckAdvertiserAccessAsync(
                    expired.AdvertiserId, 
                    expired.ScreenId);

                if (stillHasAccess.HasAccess)
                {
                    _logger.LogDebug(
                        "Advertiser {AdvertiserId} still has access to screen {ScreenId} via another booking",
                        expired.AdvertiserId, expired.ScreenId);
                    continue;
                }

                // Remove viewer from screen
                var removedConnections = viewerManager.RemoveUserFromScreen(
                    expired.AdvertiserId, 
                    expired.ScreenId.ToString());

                // Disconnect each connection via SignalR
                foreach (var connectionId in removedConnections)
                {
                    try
                    {
                        // Notify viewer they're being disconnected
                        await hubContext.Clients.Client(connectionId).SendAsync(
                            "AccessRevoked",
                            new
                            {
                                screenId = expired.ScreenId,
                                reason = "Your booking has ended",
                                expiredAt = expired.ExpiredAt
                            },
                            cancellationToken);

                        _logger.LogInformation(
                            "Sent access revocation notice to connection {ConnectionId} " +
                            "for advertiser {AdvertiserId} on screen {ScreenId}",
                            connectionId, expired.AdvertiserId, expired.ScreenId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex,
                            "Failed to send revocation notice to connection {ConnectionId}",
                            connectionId);
                    }
                }

                // Also update booking status to Completed if it was Active
                var booking = await context.Bookings.FindAsync(new object[] { expired.BookingId }, cancellationToken);
                if (booking != null && booking.Status == BookingStatus.Active)
                {
                    booking.Status = BookingStatus.Completed;
                    await context.SaveChangesAsync(cancellationToken);
                    
                    _logger.LogInformation(
                        "Updated booking {BookingId} status to Completed",
                        expired.BookingId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Error revoking access for advertiser {AdvertiserId} on screen {ScreenId}",
                    expired.AdvertiserId, expired.ScreenId);
            }
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Access revocation background service stopping.");
        await base.StopAsync(cancellationToken);
    }
}
