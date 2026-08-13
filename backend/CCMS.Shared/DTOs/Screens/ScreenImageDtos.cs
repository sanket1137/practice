namespace CCMS.Shared.DTOs.Screens;

/// <summary>
/// DTO for screen images
/// </summary>
public class ScreenImageDto
{
    public Guid Id { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    
    /// <summary>
    /// "Screen" or "Surrounding"
    /// </summary>
    public string ImageType { get; set; } = string.Empty;
    
    public int DisplayOrder { get; set; }
    public bool IsPrimary { get; set; }
    public string? OriginalFileName { get; set; }
    public long? SizeBytes { get; set; }
    public string? ContentType { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public DateTime UploadedAt { get; set; }
}

/// <summary>
/// Response after uploading screen images
/// </summary>
public class UploadScreenImagesResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public List<ScreenImageDto> UploadedImages { get; set; } = new();
    public List<string> Errors { get; set; } = new();
}

/// <summary>
/// Request to reorder screen images
/// </summary>
public class ReorderScreenImagesRequest
{
    /// <summary>
    /// List of image IDs in the new order
    /// </summary>
    public List<Guid> ImageIds { get; set; } = new();
}

/// <summary>
/// Request to set primary image
/// </summary>
public class SetPrimaryImageRequest
{
    public Guid ImageId { get; set; }
}

/// <summary>
/// Validation rules for screen images
/// </summary>
public static class ScreenImageValidation
{
    public const int MaxScreenPhotos = 4;
    public const int MaxSurroundingPhotos = 5;
    public const int MinTotalImages = 1;
    public const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10 MB
    public static readonly string[] AllowedContentTypes = { "image/jpeg", "image/jpg", "image/png", "image/webp" };
    public static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".webp" };
}
