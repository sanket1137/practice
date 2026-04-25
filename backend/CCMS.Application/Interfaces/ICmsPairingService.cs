using CCMS.Shared.DTOs.Cms;

namespace CCMS.Application.Interfaces;

/// <summary>
/// 6-digit pairing flow used by CMS-mode screens (as opposed to the DOOH QR flow).
/// </summary>
public interface ICmsPairingService
{
    /// <summary>
    /// Create a fresh 10-minute pairing code for the given CmsOwner. The dashboard
    /// displays the returned code so the owner can type it into the player device.
    /// </summary>
    Task<PairingCodeResponse> GenerateAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Polled by dashboard while waiting for a player to claim. Returns claim state
    /// and the newly-created ScreenId once the player finishes pairing.
    /// </summary>
    Task<PairingStatusResponse?> GetStatusAsync(string code, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Anonymous call made by the player device. Validates the code, provisions a
    /// Screen for the CmsOwner, binds the device fingerprint, and returns an API key.
    /// </summary>
    Task<ClaimPairingCodeResponse> ClaimAsync(ClaimPairingCodeRequest request, CancellationToken cancellationToken = default);
}
