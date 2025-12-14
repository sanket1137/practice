using MediatR;
using CCMS.Shared.DTOs.Bookings;

namespace CCMS.Application.Features.Bookings.Queries;

public class GetBookingsQuery : IRequest<IEnumerable<BookingDto>>
{
    public Guid? UserId { get; set; }
    public Guid? ScreenOwnerId { get; set; }
    public Guid? CampaignId { get; set; }
    public Guid? ScreenId { get; set; } // Filter by specific screen
    public Guid? BookingId { get; set; } // Filter by specific booking
}
