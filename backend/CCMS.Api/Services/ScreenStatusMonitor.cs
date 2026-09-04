using CCMS.Application.Interfaces;
using CCMS.Domain.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using Microsoft.AspNetCore.SignalR;
using CCMS.Api.Hubs;

namespace CCMS.Api.Services;

/// <summary>
/// Background service that monitors screen heartbeats and marks screens offline after timeout
/// </summary>
public class ScreenStatusMonitor : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ScreenStatusMonitor> _logger;
    private readonly IHubContext<PlaybackHub> _hubContext;
    private const int CHECK_INTERVAL_SECONDS = 30;
    // Pi players heartbeat every 30s; 90s tolerates one missed beat plus network
    // jitter before declaring a screen offline, instead of flapping on a single
    // slow request.
    private const int OFFLINE_TIMEOUT_SECONDS = 90;

    public ScreenStatusMonitor(
        IServiceProvider serviceProvider,
        ILogger<ScreenStatusMonitor> logger,
        IHubContext<PlaybackHub> hubContext)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _hubContext = hubContext;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("ScreenStatusMonitor started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckScreenStatuses(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in ScreenStatusMonitor");
            }

            await Task.Delay(TimeSpan.FromSeconds(CHECK_INTERVAL_SECONDS), stoppingToken);
        }

        _logger.LogInformation("ScreenStatusMonitor stopped");
    }

    private async Task CheckScreenStatuses(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var screenRepository = scope.ServiceProvider.GetRequiredService<IRepository<Screen>>();
        var bookingRepository = scope.ServiceProvider.GetRequiredService<IRepository<Booking>>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var screens = await screenRepository.GetAllAsync();
        var offlineThreshold = DateTime.UtcNow.AddSeconds(-OFFLINE_TIMEOUT_SECONDS);

        foreach (var screen in screens.Where(s => s.IsOnline))
        {
            // Check if screen hasn't sent heartbeat in the last 60 seconds
            if (screen.LastSeenAt.HasValue && screen.LastSeenAt.Value < offlineThreshold)
            {
                _logger.LogInformation($"Marking screen {screen.Id} as offline (LastSeen: {screen.LastSeenAt})");

                screen.IsOnline = false;
                await screenRepository.UpdateAsync(screen);

                // Broadcast the canonical ScreenStatusChanged event to everyone —
                // screens-list pages are not in per-screen groups.
                await _hubContext.Clients.All
                    .SendAsync("ScreenStatusChanged", new
                    {
                        screenId = screen.Id.ToString(),
                        isOnline = false,
                        lastSeen = screen.LastSeenAt,
                        timestamp = DateTime.UtcNow
                    }, stoppingToken);

                // A dark screen while paid campaigns are running is lost revenue
                // and a delivery-percentage hit — the owner hears about it the
                // moment it's detected, not when the payout comes up short.
                // Debounce comes free: this only runs on the online→offline
                // transition (the screen is excluded from the loop once offline).
                await AlertOwnerIfBookingAtRiskAsync(screen, bookingRepository, notificationService);
            }
        }
    }

    private async Task AlertOwnerIfBookingAtRiskAsync(
        Screen screen,
        IRepository<Booking> bookingRepository,
        INotificationService notificationService)
    {
        try
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var atRisk = (await bookingRepository.FindAsync(b =>
                b.ScreenId == screen.Id && !b.IsDeleted &&
                (b.Status == BookingStatus.Active || b.Status == BookingStatus.Approved) &&
                b.StartDate <= today && b.EndDate >= today)).ToList();

            if (atRisk.Count == 0) return;

            var revenueAtRisk = atRisk.Sum(b => b.TotalPrice);
            await notificationService.CreateNotificationAsync(
                screen.OwnerId,
                "Screen offline during active campaign",
                $"'{screen.Name}' stopped responding while {atRisk.Count} paid booking(s) " +
                $"worth {atRisk.First().Currency} {revenueAtRisk:N0} are running. " +
                "Plays are not being delivered until the player reconnects.",
                NotificationType.SystemAlert,
                $"/screens/{screen.Id}?tab=device");

            // The advertiser paying for those plays hears it too — with the
            // reassurance that delivery-linked settlement protects their spend.
            using var scope = _serviceProvider.CreateScope();
            var campaignRepository = scope.ServiceProvider.GetRequiredService<IRepository<Campaign>>();
            var advertiserIds = new HashSet<Guid>();
            foreach (var booking in atRisk.Where(b => b.CampaignId.HasValue))
            {
                var campaign = await campaignRepository.GetByIdAsync(booking.CampaignId!.Value);
                if (campaign != null && advertiserIds.Add(campaign.AdvertiserId))
                {
                    await notificationService.CreateNotificationAsync(
                        campaign.AdvertiserId,
                        "Your campaign screen is offline",
                        $"'{screen.Name}' went offline while your campaign is running. Plays are " +
                        "paused and every play is counted — your final settlement is delivery-linked, " +
                        "so you only pay for what actually airs. We've alerted the screen owner.",
                        NotificationType.SystemAlert,
                        $"/bookings/{booking.Id}");
                }
            }

            _logger.LogWarning(
                "Screen {ScreenId} went offline with {Count} active booking(s) at risk (owner + {AdvCount} advertiser(s) notified)",
                screen.Id, atRisk.Count, advertiserIds.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send offline-during-booking alert for screen {ScreenId}", screen.Id);
        }
    }
}
