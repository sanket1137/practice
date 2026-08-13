using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

public class PricingRule : BaseEntity
{
    public Guid ScreenId { get; set; }
    public string Name { get; set; } = string.Empty;
    public PricingRuleType RuleType { get; set; }

    // Prices (null = use screen base price)
    public decimal? RegularSlotPrice { get; set; }

    public bool IsActive { get; set; } = true;

    // For DateRange and SpecificDate rule types
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }

    // For Weekday rule type: comma-separated day numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
    public string? DaysOfWeek { get; set; }

    // Navigation
    public virtual Screen Screen { get; set; } = null!;
}
