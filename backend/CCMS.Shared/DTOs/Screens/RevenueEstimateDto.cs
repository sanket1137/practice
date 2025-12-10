namespace CCMS.Shared.DTOs.Screens;

public class RevenueEstimateDto
{
    public decimal PerFrame { get; set; } // Revenue per complete time frame
    public decimal PerHour { get; set; }
    public Dictionary<string, decimal> Daily { get; set; } = new();
    public decimal Weekly { get; set; }
    public decimal Monthly { get; set; }
    
    // Deprecated - kept for backward compatibility
    public decimal PerMinute { get; set; }
}
