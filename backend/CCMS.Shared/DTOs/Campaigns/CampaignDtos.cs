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

// ── Atomic wizard DTOs ──────────────────────────────────────────────────────

public class CampaignWizardBookingRequest
{
    public Guid ScreenId { get; set; }
    public Guid CreativeId { get; set; }
}

public class CampaignWizardRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Objective { get; set; }
    public decimal Budget { get; set; }
    public string Currency { get; set; } = "INR";
    public string StartDate { get; set; } = string.Empty; // YYYY-MM-DD
    public string EndDate { get; set; } = string.Empty;   // YYYY-MM-DD
    public List<CampaignWizardBookingRequest> Bookings { get; set; } = new();
}

public class CampaignWizardBookingResult
{
    public Guid BookingId { get; set; }
    public Guid ScreenId { get; set; }
    public decimal TotalPrice { get; set; }
    public string Currency { get; set; } = "INR";
}

public class CampaignWizardResult
{
    public Guid CampaignId { get; set; }
    public string CampaignName { get; set; } = string.Empty;
    public List<CampaignWizardBookingResult> Bookings { get; set; } = new();
    public decimal TotalCharged { get; set; }
    public string Currency { get; set; } = "INR";
}
