namespace CCMS.Application.Interfaces;

/// <summary>
/// Service for sending real-time notifications to players
/// </summary>
public interface IPlaylistNotificationService
{
    /// <summary>
    /// Notify players that playlist has been updated
    /// </summary>
    Task NotifyPlaylistUpdatedAsync(Guid screenId, int slotNumber, string action, CancellationToken cancellationToken = default);
}
