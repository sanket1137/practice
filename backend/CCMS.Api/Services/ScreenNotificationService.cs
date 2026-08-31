using CCMS.Api.Hubs;
using CCMS.Application.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace CCMS.Api.Services;

public class ScreenNotificationService : IScreenNotificationService
{
    private readonly IHubContext<PlaybackHub> _hubContext;
    private readonly ILogger<ScreenNotificationService> _logger;

    public ScreenNotificationService(
        IHubContext<PlaybackHub> hubContext,
        ILogger<ScreenNotificationService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task NotifyScreenStatusChangedAsync(Guid screenId, string status, CancellationToken cancellationToken = default)
    {
        try
        {
            // Sent to All: screens-list and marketplace pages are not subscribed
            // to per-screen groups. Event is distinct from "ScreenStatusChanged"
            // (heartbeat online/offline) — this one carries the lifecycle status.
            await _hubContext.Clients.All.SendAsync("ScreenLifecycleChanged", new
            {
                screenId = screenId.ToString(),
                status,
                timestamp = DateTime.UtcNow
            }, cancellationToken);

            _logger.LogInformation("[SignalR] ScreenLifecycleChanged broadcast: screen={ScreenId}, status={Status}",
                screenId, status);
        }
        catch (Exception ex)
        {
            // Real-time updates are best-effort — never fail the underlying
            // state change because a broadcast failed.
            _logger.LogWarning(ex, "Failed to broadcast ScreenLifecycleChanged for screen {ScreenId}", screenId);
        }
    }
}
