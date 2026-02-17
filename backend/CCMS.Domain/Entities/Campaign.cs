using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

public class Campaign : BaseEntity
{
    public Guid AdvertiserId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; } // Optional - null means indefinite campaign
    public decimal Budget { get; set; }
    public required string Currency { get; set; } = "INR";
    public CampaignStatus Status { get; set; } = CampaignStatus.Draft;
    
    // Navigation properties
    public virtual User Advertiser { get; set; } = null!;
    public virtual ICollection<Creative> Creatives { get; set; } = new List<Creative>();
    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();
}
