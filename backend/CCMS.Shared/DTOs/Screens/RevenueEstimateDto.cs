namespace CCMS.Shared.DTOs.Screens;

public class RevenueEstimateDto
{
    public decimal PerFrame { get; set; } // Revenue per complete time frame
    public decimal PerHour { get; set; }
    public Dictionary<string, DayBreakdownDto> DailyBreakdown { get; set; } = new();
    public decimal Weekly { get; set; }
    public decimal Monthly { get; set; }
    
    // Screen config summary
    public int SlotDurationSeconds { get; set; }
    public int TotalWeeklySlotPlays { get; set; }
    
    // Deprecated - kept for backward compatibility
    public decimal PerMinute { get; set; }
    public Dictionary<string, decimal> Daily { get; set; } = new();
}

public class DayBreakdownDto
{
    public bool IsOperating { get; set; }
    public string OperatingHours { get; set; } = string.Empty;   // e.g. "09:00–22:00"
    public decimal OperatingHoursDecimal { get; set; }            // e.g. 13.0
    public int FramesPerDay { get; set; }
    public int TotalSlotPlays { get; set; }                       // FramesPerDay × SlotsPerFrame
    public decimal Revenue { get; set; }
}
