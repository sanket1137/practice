using MediatR;
using CCMS.Shared.DTOs.Bookings;

namespace CCMS.Application.Features.Bookings.Commands;

public class CreateBookingCommand : IRequest<BookingDto>
{
    public Guid UserId { get; set; }
    public CreateBookingRequest Request { get; set; } = null!;
}
