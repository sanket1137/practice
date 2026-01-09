using CCMS.Domain.Entities;

namespace CCMS.Domain.Entities;

/// <summary>
/// Represents custom content uploaded by screen owner for empty slots
/// </summary>
public class OwnerContent : BaseEntity
{
    public Guid ScreenId { get; set; }
    public int SlotNumber { get; set; }
    public string Name { get; set; } = string.Empty;
    
    // File information
    public string FileUrl { get; set; } = string.Empty;
    public string FileHash { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public int Duration { get; set; } // in seconds
    
    // Revenue tracking
    public decimal PricePerPlay { get; set; }
    public string Currency { get; set; } = "INR"; // Default to Indian Rupee
    
    // Status
    public bool IsActive { get; set; } = true;
    public DateTime? UpdatedAt { get; set; }
    
    // Navigation properties
    public virtual Screen Screen { get; set; } = null!;
    public virtual ICollection<Impression> Impressions { get; set; } = new List<Impression>();
}
