namespace CCMS.Application.Interfaces;

/// <summary>
/// Real-time notifications about screen lifecycle changes, broadcast over the
/// PlaybackHub (the platform's single real-time channel). Implemented in the API
/// layer, consumed from Application-layer handlers — same pattern as
/// IBookingNotificationService / IPlaylistNotificationService.
/// </summary>
public interface IScreenNotificationService
{
    /// <summary>
    /// Broadcast that a screen's administrative status changed (Active /
    /// Inactive / Maintenance / Offline). Distinct from the online/offline
    /// heartbeat signal — this is the owner-managed lifecycle state, and
    /// dashboards use it to refresh screen cards without a manual reload.
    /// </summary>
    Task NotifyScreenStatusChangedAsync(Guid screenId, string status, CancellationToken cancellationToken = default);
}
