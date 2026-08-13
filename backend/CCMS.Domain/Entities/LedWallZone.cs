namespace CCMS.Domain.Entities;

/// <summary>
/// Represents a named zone on an LED video wall canvas.
/// Each zone has its own content assignment (playlist or ticker).
/// </summary>
public class LedWallZone : BaseEntity
{
    public Guid ScreenId { get; set; }
    public string Name { get; set; } = string.Empty;

    // Position and size within the LED canvas (pixels)
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }

    // Content type for this zone
    public LedZoneContentType ContentType { get; set; } = LedZoneContentType.Playlist;
    public string? ContentConfig { get; set; } // JSON: playlistId, rss url, static text, etc.

    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; } = 0;

    // Navigation
    public virtual Screen Screen { get; set; } = null!;
}

public enum LedZoneContentType
{
    Playlist = 0,
    RssTicker = 1,
    StaticText = 2,
    Clock = 3,
}

/// <summary>
/// Represents an LED controller agent registration.
/// The PixelSpot LED Agent running on the controller Windows PC registers here.
/// </summary>
public class LedControllerAgent : BaseEntity
{
    public Guid ScreenId { get; set; }
    public string AgentVersion { get; set; } = string.Empty;
    public string ControllerSoftware { get; set; } = string.Empty; // Novastar, Colorlight, etc.
    public string DeviceToken { get; set; } = string.Empty; // DPAPI-encrypted token for auth
    public DateTime LastSeenAt { get; set; }
    public string? IpAddress { get; set; }
    public decimal? TemperatureCelsius { get; set; }
    public bool IsOnline { get; set; } = false;

    // Navigation
    public virtual Screen Screen { get; set; } = null!;
}
