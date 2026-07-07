namespace CCMS.Shared.DTOs.Creatives;

public class CreativeDto
{
    public Guid Id { get; set; }
    public Guid? CampaignId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public int Duration { get; set; }
    public string? ThumbnailUrl { get; set; }
    public string Status { get; set; } = "PendingReview";
    public string? ReviewNotes { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? UploaderName { get; set; }
    public Guid? UploadedById { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class UploadCreativeRequest
{
    public Guid CampaignId { get; set; }
    public string Name { get; set; } = string.Empty;
    // File will be uploaded via IFormFile in the controller
}

public class AdminCreativeDto : CreativeDto
{
    public string? UploaderEmail { get; set; }
}

public class ReviewCreativeRequest
{
    public string Action { get; set; } = string.Empty; // "approve" | "reject"
    public string? ReviewNotes { get; set; }
}

public class BulkApproveRequest
{
    public List<Guid> CreativeIds { get; set; } = new();
}

/// <summary>
/// PATCH /api/creatives/{id}: rename / re-duration a creative the caller owns.
/// All fields optional; only provided fields are updated.
/// </summary>
public class UpdateCreativeRequest
{
    public string? Name { get; set; }
    public int? Duration { get; set; }
}

/// <summary>
/// POST /api/creatives/{id}/attach: attach an existing library creative to a campaign.
/// If the creative is already attached to a different campaign, the server clones the asset.
/// </summary>
public class AttachCreativeRequest
{
    public Guid CampaignId { get; set; }
}
