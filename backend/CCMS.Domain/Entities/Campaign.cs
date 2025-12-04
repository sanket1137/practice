using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

public class Campaign : BaseEntity
{
    public Guid AdvertiserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Budget { get; set; }
    public string Currency { get; set; } = "USD";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public CampaignStatus Status { get; set; } = CampaignStatus.Draft;
    
    // Navigation properties
    public virtual User Advertiser { get; set; } = null!;
    public virtual ICollection<Creative> Creatives { get; set; } = new List<Creative>();
    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();
}
