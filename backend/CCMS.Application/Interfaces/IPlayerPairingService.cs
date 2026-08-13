using CCMS.Shared.DTOs.Player;

namespace CCMS.Application.Interfaces;

public interface IPlayerPairingService
{
    /// <summary>Player requests a new token on first launch. Anonymous.</summary>
    Task<RequestPlayerPairingTokenResponse> RequestTokenAsync(
        RequestPlayerPairingTokenRequest request,
        string baseUrl,
        CancellationToken ct = default);

    /// <summary>Player polls until claimed or expired.</summary>
    Task<PlayerPairingStatusResponse> GetStatusAsync(string token, CancellationToken ct = default);

    /// <summary>Dashboard CMS owner scans player QR and fills minimal form.</summary>
    Task<ClaimPlayerQrResponse> ClaimAsCmsAsync(
        Guid userId,
        ClaimPlayerQrCmsRequest request,
        CancellationToken ct = default);

    /// <summary>Dashboard CCMS (MediaOwner) scans player QR and fills full form.</summary>
    Task<ClaimPlayerQrResponse> ClaimAsCcmsAsync(
        Guid userId,
        ClaimPlayerQrCcmsRequest request,
        CancellationToken ct = default);
}
