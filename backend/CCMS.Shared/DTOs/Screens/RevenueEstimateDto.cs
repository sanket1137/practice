namespace CCMS.Shared.DTOs.Screens;

public class RevenueEstimateDto
{
    public decimal PerMinute { get; set; }
    public decimal PerHour { get; set; }
    public Dictionary<string, decimal> Daily { get; set; } = new();
    public decimal Weekly { get; set; }
    public decimal Monthly { get; set; }
}
