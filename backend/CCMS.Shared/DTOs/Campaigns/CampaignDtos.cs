namespace CCMS.Shared.DTOs.Campaigns;

public class CampaignDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Budget { get; set; }
    public string Currency { get; set; } = "INR";
    public string StartDate { get; set; } = string.Empty; // YYYY-MM-DD format
    public string EndDate { get; set; } = string.Empty;   // YYYY-MM-DD format
    public string Status { get; set; } = string.Empty;
    public int TotalCreatives { get; set; }
    public int TotalBookings { get; set; }
    public int TotalImpressions { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateCampaignRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Budget { get; set; }
    public string Currency { get; set; } = "INR";
    public string StartDate { get; set; } = string.Empty; // YYYY-MM-DD format
    public string EndDate { get; set; } = string.Empty;   // YYYY-MM-DD format
}

public class UpdateCampaignRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public decimal? Budget { get; set; }
    public string? StartDate { get; set; }  // YYYY-MM-DD format
    public string? EndDate { get; set; }    // YYYY-MM-DD format
    public string? Status { get; set; }
}
