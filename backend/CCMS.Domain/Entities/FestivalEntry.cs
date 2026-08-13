namespace CCMS.Domain.Entities;

public class FestivalEntry : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public int Year { get; set; }
    public string Region { get; set; } = "India";
    public decimal SuggestedMultiplier { get; set; } = 1.5m;
    public bool IsActive { get; set; } = true;
}
