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
