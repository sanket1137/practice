using CCMS.Domain.Interfaces;
using CCMS.Domain.Entities;
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
            }
        }
    }
}
