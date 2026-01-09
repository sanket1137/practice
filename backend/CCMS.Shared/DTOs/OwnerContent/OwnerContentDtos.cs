namespace CCMS.Shared.DTOs.OwnerContent;

public class CreateOwnerContentRequest
{
    public int SlotNumber { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal PricePerPlay { get; set; }
}

public class OwnerContentDto
{
    public Guid Id { get; set; }
    public int SlotNumber { get; set; }
    public string Name { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public int Duration { get; set; }
    public decimal PricePerPlay { get; set; }
    public int TotalPlays { get; set; }
    public decimal TotalRevenue { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class SlotStatusDto
{
    public int SlotNumber { get; set; }
    public string Status { get; set; } = "Empty"; // Empty | Custom | Booked
    public string? ContentName { get; set; }
    public string? VideoUrl { get; set; }
    public bool CanEdit { get; set; } = true;
    public OwnerContentDto? OwnerContent { get; set; }
    public Shared.DTOs.Bookings.BookingDto? ActiveBooking { get; set; }
}
