using CCMS.Domain.Entities;

namespace CCMS.Application.DTOs;

public class PlaylistItemResponse
{
    public string StartTime { get; set; } = string.Empty; // HH:mm format
    public string EndTime { get; set; } = string.Empty;
    public int SlotNumber { get; set; }
    public Guid? BookingId { get; set; } // Null if filler content
    public Guid? CampaignId { get; set; }
    public Guid? CreativeId { get; set; }
    public string? CreativeUrl { get; set; }
    public string? CreativeMimeType { get; set; }
    public int DurationSeconds { get; set; }
    public Guid ImpressionId { get; set; } // Pre-generated for tracking
    public bool IsFillerContent { get; set; } // True if no booking exists
}

public class PlaylistResponse
{
    public Guid ScreenId { get; set; }
    public string ScreenName { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string OperatingStart { get; set; } = string.Empty; // HH:mm
    public string OperatingEnd { get; set; } = string.Empty;
    public int TimeFrameMinutes { get; set; }
    public int SlotsPerFrame { get; set; }
    public List<PlaylistItemResponse> Playlist { get; set; } = new();
    public int TotalSlots { get; set; }
    public int BookedSlots { get; set; }
    public int FillerSlots { get; set; }
}
