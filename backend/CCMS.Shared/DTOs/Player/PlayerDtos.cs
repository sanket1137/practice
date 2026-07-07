namespace CCMS.Shared.DTOs.Player;

/// <summary>Slim schedule window payload sent to the player inside the handshake response.</summary>
public class ScheduleWindowPlayerDto
{
    public Guid Id { get; set; }
    public int DaysOfWeekMask { get; set; }
    public int StartMinute { get; set; }
    public int EndMinute { get; set; }
    public Guid PlaylistId { get; set; }
    public string? Label { get; set; }
    /// <summary>Ordered playlist items for this window (same shape as CmsPlaylist.Items).</summary>
    public List<CCMS.Shared.DTOs.Cms.CmsPlaylistItemDto> Items { get; set; } = new();
}

public class HandshakeRequest
{
    // Screen identification
    public string ScreenId { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    
    // Device identification
    public string DeviceId { get; set; } = string.Empty;
    public string DeviceToken { get; set; } = string.Empty;
    public string PlayerVersion { get; set; } = "1.0.0";
    public string OsVersion { get; set; } = string.Empty;
    
    // Device binding for security
    public string? DeviceFingerprint { get; set; }
    
    // Security fields for secure handshake
    public string? Nonce { get; set; }
    public long? Timestamp { get; set; }
}

public class HandshakeResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public DateTime ServerTime { get; set; }
    public object? Playlist { get; set; }
    public int SyncIntervalMinutes { get; set; }
    
    // Screen timezone and operating hours for player enforcement
    public string? ScreenTimezone { get; set; }
    public Dictionary<string, string>? OperatingHours { get; set; } // {DayName: "HH:MM-HH:MM"}
    
    // Verification salt for impression authenticity
    public string? VerificationSalt { get; set; }
    
    // Secure session tokens for HMAC signing
    public string? SessionToken { get; set; }
    public string? ServerSalt { get; set; }
    public DateTime? SessionExpiresAt { get; set; }
    
    // Device binding status
    public string? DeviceBindingStatus { get; set; } // "bound", "new_binding", "override", "not_provided"
    
    // Screen verification (QR-based physical verification)
    public bool VerificationMode { get; set; }
    public string? VerificationStatus { get; set; }
    public string? QrChallengeUrl { get; set; }

    // CMS-mode payload. Present only when the screen owner is a CmsOwner;
    // players should prefer this playlist over <see cref="Playlist"/> when set.
    public CCMS.Shared.DTOs.Cms.CmsPlaylistDto? CmsPlaylist { get; set; }

    // Schedule windows for day-parting (CMS mode only). The player checks these
    // every minute and switches to the matching playlist when a window is active.
    public List<ScheduleWindowPlayerDto>? ScheduleWindows { get; set; }

    // Screen mode — "Cms" or "Dooh". Lets the player pick the right code path
    // without having to infer from which playlist field is populated.
    public string? ScreenMode { get; set; }
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
