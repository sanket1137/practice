namespace CCMS.Shared.DTOs.Screens;

public class ScreenAvailabilityDto
{
    public List<DailyAvailabilityDto> Availability { get; set; } = new();
    public AvailabilitySummaryDto Summary { get; set; } = new();
}

public class DailyAvailabilityDto
{
    public DateTime Date { get; set; }
    public string DayOfWeek { get; set; } = string.Empty;
    public int TotalSlots { get; set; }
    public int AvailableSlots { get; set; }
    public List<int> AvailableSlotNumbers { get; set; } = new();
    public string Status { get; set; } = string.Empty; // AVAILABLE, LIMITED, SOLD_OUT
}

public class AvailabilitySummaryDto
{
    public int TotalDays { get; set; }
    public int AvailableDays { get; set; }
    public int SoldOutDays { get; set; }
    public int TotalAvailableSlots { get; set; }
}
