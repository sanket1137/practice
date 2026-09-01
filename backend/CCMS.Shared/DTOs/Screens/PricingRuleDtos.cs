namespace CCMS.Shared.DTOs.Screens;

public class PricingRuleDto
{
    public Guid Id { get; set; }
    public Guid ScreenId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string RuleType { get; set; } = string.Empty; // "Weekday" | "DateRange" | "SpecificDate"
    public decimal? RegularSlotPrice { get; set; }
    public bool IsActive { get; set; }
    public string? StartDate { get; set; } // YYYY-MM-DD
    public string? EndDate { get; set; }   // YYYY-MM-DD
    public string? DaysOfWeek { get; set; } // comma-separated, e.g. "1,6" for Mon+Sat
    public DateTime CreatedAt { get; set; }
}

public class CreatePricingRuleRequest
{
    public string Name { get; set; } = string.Empty;
    public string RuleType { get; set; } = "DateRange";
    public decimal? RegularSlotPrice { get; set; }
    public bool IsActive { get; set; } = true;
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public string? DaysOfWeek { get; set; }
}

public class UpdatePricingRuleRequest : CreatePricingRuleRequest
{
}

/// <summary>One day of slot demand, read from SlotAvailability.</summary>
public class DayDemandDto
{
    public string Date { get; set; } = string.Empty; // YYYY-MM-DD
    public int TotalSlots { get; set; }
    public int BookedSlots { get; set; }
}

/// <summary>
/// Aggregate slot-price benchmark for comparable active screens.
/// SampleSize 0 means no comparable pool of at least 3 screens exists.
/// </summary>
public class PriceBenchmarkDto
{
    /// <summary>Human label of the comparable pool (e.g. "Pune · Billboard"), null when none.</summary>
    public string? Scope { get; set; }
    public int SampleSize { get; set; }
    public string Currency { get; set; } = "INR";
    public decimal YourPrice { get; set; }
    public decimal? P25 { get; set; }
    public decimal? Median { get; set; }
    public decimal? P75 { get; set; }
}
