namespace CCMS.Shared.DTOs.Cms;

/// <summary>Response after a CMS owner requests a pairing code.</summary>
public class PairingCodeResponse
{
    public string Code { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    /// <summary>URL-encoded QR content for dashboard to render as a QR image.</summary>
    public string QrPayload { get; set; } = string.Empty;
}

/// <summary>
/// Status polled by dashboard while waiting for the player to claim the code.
/// </summary>
public class PairingStatusResponse
{
    public string Code { get; set; } = string.Empty;
    public bool IsClaimed { get; set; }
    public bool IsExpired { get; set; }
    public Guid? ScreenId { get; set; }
    public DateTime ExpiresAt { get; set; }
}

/// <summary>Player posts this when the CMS owner types the code in the dashboard.</summary>
public class ClaimPairingCodeRequest
{
    public string Code { get; set; } = string.Empty;
    public string DeviceFingerprint { get; set; } = string.Empty;
    public string? DeviceModel { get; set; }
    public string? OsVersion { get; set; }
    public string? AppVersion { get; set; }
    public string? Orientation { get; set; }
    public int? ResolutionWidth { get; set; }
    public int? ResolutionHeight { get; set; }
    public string? LocationTag { get; set; }
}

/// <summary>Returned to the player after a successful claim.</summary>
public class ClaimPairingCodeResponse
{
    public Guid ScreenId { get; set; }
    public string ApiKey { get; set; } = string.Empty;
    public string ScreenName { get; set; } = string.Empty;
}
