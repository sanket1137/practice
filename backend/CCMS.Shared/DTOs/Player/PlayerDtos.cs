namespace CCMS.Shared.DTOs.Player;

public class HandshakeRequest
{
    public string DeviceId { get; set; } = string.Empty;
    public string DeviceToken { get; set; } = string.Empty;
    public string PlayerVersion { get; set; } = "1.0.0";
    public string OsVersion { get; set; } = string.Empty;
}

public class HandshakeResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public DateTime ServerTime { get; set; }
    public object? Playlist { get; set; }
    public int SyncIntervalMinutes { get; set; }
}

public class PlaylistDto
{
    public Guid ScreenId { get; set; }
    public DateTime Date { get; set; }
    public List<PlaylistItemDto> Items { get; set; } = new();
}

public class PlaylistItemDto
{
    public Guid CreativeId { get; set; }
    public Guid? BookingId { get; set; } // Nullable for owner content
    public Guid? OwnerContentId { get; set; } // For owner custom content
    public string FileUrl { get; set; } = string.Empty;
    public string FileHash { get; set; } = string.Empty;
    public int Duration { get; set; } // in seconds
    public int SlotPosition { get; set; }
    public int RepeatCount { get; set; }
}

public class ReportImpressionRequest
{
    public string DeviceId { get; set; } = string.Empty;
    public Guid BookingId { get; set; }
    public Guid CreativeId { get; set; }
    public DateTime PlayTimestamp { get; set; }
    public int PlayCount { get; set; } = 1;
}
