using MediatR;
using CCMS.Shared.DTOs.Bookings;

namespace CCMS.Application.Features.Bookings.Commands;

public class UpdateBookingDatesCommand : IRequest<BookingDto>
{
    public Guid BookingId { get; set; }
    public Guid UserId { get; set; }
    public UpdateBookingDatesRequest Request { get; set; } = null!;
}
