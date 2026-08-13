namespace CCMS.Shared.DTOs.Bookings;

public class SelfReserveSlotRequest
{
    public Guid ScreenId { get; set; }
    public Guid CreativeId { get; set; }
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public int? SlotNumber { get; set; }
    public string? ClientName { get; set; }
    public string? ClientContact { get; set; }
    public string? InternalNotes { get; set; }
    public decimal? Price { get; set; }
}
