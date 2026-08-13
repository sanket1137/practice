namespace CCMS.Shared.DTOs.Player;

// ── Player → Server ─────────────────────────────────────────────────────────

/// <summary>Player calls this on first launch to obtain a QR pairing token.</summary>
public class RequestPlayerPairingTokenRequest
{
    public string DeviceFingerprint { get; set; } = string.Empty;
    public string? DeviceModel { get; set; }
    public string? OsVersion { get; set; }
    public string? AppVersion { get; set; }
}

/// <summary>Returned to the player immediately. Player shows QrContent as a QR code.</summary>
public class RequestPlayerPairingTokenResponse
{
    /// <summary>Opaque token embedded in the QR URL.</summary>
    public string Token { get; set; } = string.Empty;

    /// <summary>Full URL to encode as QR: e.g. https://ccms.pixelspot.in/player-pair?token=...</summary>
    public string QrContent { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }
}

/// <summary>Player polls this until claimed.</summary>
public class PlayerPairingStatusResponse
{
    public bool IsClaimed { get; set; }
    public bool IsExpired { get; set; }
    /// <summary>Only set after a successful claim.</summary>
    public Guid? ScreenId { get; set; }
    /// <summary>Raw API key — shown once. Player must persist this immediately.</summary>
    public string? ApiKey { get; set; }
}

// ── Dashboard (authenticated) → Server ──────────────────────────────────────

/// <summary>CMS owner fills this minimal form to claim the player QR.</summary>
public class ClaimPlayerQrCmsRequest
{
    public string Token { get; set; } = string.Empty;
    public string ScreenName { get; set; } = "My Screen";
    /// <summary>"Landscape" or "Portrait"</summary>
    public string Orientation { get; set; } = "Landscape";
    public int ResolutionWidth { get; set; } = 1920;
    public int ResolutionHeight { get; set; } = 1080;
    /// <summary>Venue / location tag, e.g. "Floor 1 – Main Entrance".</summary>
    public string? Venue { get; set; }
}

/// <summary>CCMS (MediaOwner) fills full screen details when claiming the player QR.</summary>
public class ClaimPlayerQrCcmsRequest
{
    public string Token { get; set; } = string.Empty;
    public string ScreenName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Orientation { get; set; } = "Landscape";
    public int ResolutionWidth { get; set; } = 1920;
    public int ResolutionHeight { get; set; } = 1080;
    // Location
    public string Street { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Country { get; set; } = "India";
    public string PostalCode { get; set; } = string.Empty;
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public string Timezone { get; set; } = "Asia/Kolkata";
    // Pricing & slots
    public decimal PricePerSlot { get; set; }
    public string Currency { get; set; } = "INR";
    public int TimeFrameMinutes { get; set; } = 1;
    public int SlotsPerFrame { get; set; } = 6;
    // Operating hours (JSON blob passed through as-is)
    public object? Schedule { get; set; }
}

public class ClaimPlayerQrResponse
{
    public Guid ScreenId { get; set; }
    public string ScreenName { get; set; } = string.Empty;
}
