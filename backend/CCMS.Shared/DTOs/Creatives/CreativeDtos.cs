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
    public DateTime CreatedAt { get; set; }
}

public class UploadCreativeRequest
{
    public Guid CampaignId { get; set; }
    public string Name { get; set; } = string.Empty;
    // File will be uploaded via IFormFile in the controller
}
