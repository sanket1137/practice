using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

/// <summary>
/// Represents an image associated with a screen (screen photos or surrounding environment photos)
/// </summary>
public class ScreenImage : BaseEntity
{
    /// <summary>
    /// Reference to the screen this image belongs to
    /// </summary>
    public Guid ScreenId { get; set; }
    
    /// <summary>
    /// URL to the image in blob storage
    /// Format: screens/{screenId}/images/{type}_{index}.{ext}
    /// </summary>
    public string ImageUrl { get; set; } = string.Empty;
    
    /// <summary>
    /// Type of image (Screen photo or Surrounding environment photo)
    /// </summary>
    public ScreenImageType ImageType { get; set; }
    
    /// <summary>
    /// Display order within the image type (0-based)
    /// </summary>
    public int DisplayOrder { get; set; }
    
    /// <summary>
    /// Whether this is the primary/thumbnail image for the screen
    /// Only one image per screen should have IsPrimary = true
    /// </summary>
    public bool IsPrimary { get; set; }
    
    /// <summary>
    /// Original filename uploaded by the user
    /// </summary>
    public string OriginalFileName { get; set; } = string.Empty;
    
    /// <summary>
    /// File size in bytes
    /// </summary>
    public long SizeBytes { get; set; }
    
    /// <summary>
    /// Content type (e.g., image/jpeg, image/png)
    /// </summary>
    public string ContentType { get; set; } = string.Empty;
    
    /// <summary>
    /// Image width in pixels (after processing)
    /// </summary>
    public int? Width { get; set; }
    
    /// <summary>
    /// Image height in pixels (after processing)
    /// </summary>
    public int? Height { get; set; }
    
    /// <summary>
    /// When the image was uploaded
    /// </summary>
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation property
    public virtual Screen Screen { get; set; } = null!;
}
