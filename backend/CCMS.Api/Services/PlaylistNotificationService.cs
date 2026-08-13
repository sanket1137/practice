using CCMS.Application.Interfaces;
using CCMS.Api.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace CCMS.Api.Services;

public class PlaylistNotificationService : IPlaylistNotificationService
{
    private readonly IHubContext<PlaybackHub> _hubContext;
    private readonly ILogger<PlaylistNotificationService> _logger;

    public PlaylistNotificationService(
        IHubContext<PlaybackHub> hubContext,
        ILogger<PlaylistNotificationService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task NotifyPlaylistUpdatedAsync(Guid screenId, int slotNumber, string action, CancellationToken cancellationToken = default)
    {
        try
        {
            await _hubContext.Clients.Group($"screen_{screenId}")
                .SendAsync("PlaylistUpdated", new
                {
                    screenId = screenId.ToString(),
                    slotNumber,
                    action,
                    timestamp = DateTime.UtcNow
                }, cancellationToken);

            _logger.LogInformation($"SignalR PlaylistUpdated event sent: screen={screenId}, slot={slotNumber}, action={action}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to send PlaylistUpdated notification for screen {screenId}");
            throw;
        }
    }
}
