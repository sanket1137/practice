namespace CCMS.Shared.DTOs.Screens;

public class ScreenDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal PhysicalWidth { get; set; }
    public decimal PhysicalHeight { get; set; }
    public string DimensionUnit { get; set; } = "feet";
    public int ResolutionWidth { get; set; }
    public int ResolutionHeight { get; set; }
    public AddressDto Location { get; set; } = new();
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public OperatingScheduleDto Schedule { get; set; } = new();
    public int TimeFrameMinutes { get; set; }
    public int SlotsPerFrame { get; set; }
    public string DeviceId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal PricePerSlot { get; set; }
    public string Currency { get; set; } = "USD";
    public int ImpressionsPerSlot { get; set; }
    public int DailyTotalImpressions { get; set; }
    public DateTime? LastSyncAt { get; set; }
    public bool IsOnline { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateScreenRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal PhysicalWidth { get; set; }
    public decimal PhysicalHeight { get; set; }
    public string DimensionUnit { get; set; } = "feet";
    public int ResolutionWidth { get; set; }
    public int ResolutionHeight { get; set; }
    public AddressDto Location { get; set; } = new();
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public OperatingScheduleDto Schedule { get; set; } = new();
    public int TimeFrameMinutes { get; set; }
    public int SlotsPerFrame { get; set; }
    public string DeviceId { get; set; } = string.Empty;
    public decimal PricePerSlot { get; set; }
    public string Currency { get; set; } = "USD";
}

public class UpdateScreenRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public decimal? PhysicalWidth { get; set; }
    public decimal? PhysicalHeight { get; set; }
    public int? ResolutionWidth { get; set; }
    public int? ResolutionHeight { get; set; }
    public AddressDto? Location { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public OperatingScheduleDto? Schedule { get; set; }
    public int? TimeFrameMinutes { get; set; }
    public int? SlotsPerFrame { get; set; }
    public decimal? PricePerSlot { get; set; }
    public string? Status { get; set; }
}

public class AddressDto
{
    public string Street { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;
}

public class DayScheduleDto
{
    public string StartTime { get; set; } = "09:00"; // HH:mm format
    public string EndTime { get; set; } = "22:00";
    public bool IsOperating { get; set; }
}

public class OperatingScheduleDto
{
    public DayScheduleDto Monday { get; set; } = new();
    public DayScheduleDto Tuesday { get; set; } = new();
    public DayScheduleDto Wednesday { get; set; } = new();
    public DayScheduleDto Thursday { get; set; } = new();
    public DayScheduleDto Friday { get; set; } = new();
    public DayScheduleDto Saturday { get; set; } = new();
    public DayScheduleDto Sunday { get; set; } = new();
}
