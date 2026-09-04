namespace CCMS.Shared.DTOs.Screens;

public class SlotCalendarDto
{
    public Guid ScreenId { get; set; }
    public string ScreenName { get; set; } = string.Empty;
    public int SlotsPerFrame { get; set; }
    public List<CalendarDayDto> Days { get; set; } = new();
}

public class CalendarDayDto
{
    public DateTime Date { get; set; }
    public List<CalendarSlotDto> Slots { get; set; } = new();
    public bool IsOperating { get; set; }
}

public class CalendarSlotDto
{
    public int SlotNumber { get; set; }
    public string Status { get; set; } = "available"; // available, booked
    public Guid? BookingId { get; set; }
    public string? CampaignName { get; set; }
    /// <summary>True when this booked slot belongs to the requesting user
    /// (their campaign, or their own reservation on their own screen).</summary>
    public bool IsMine { get; set; }
}
