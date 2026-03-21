using MediatR;
using CCMS.Shared.DTOs.Bookings;

namespace CCMS.Application.Features.Bookings.Commands;

public class SelfReserveSlotCommand : IRequest<BookingDto>
{
    public Guid UserId { get; set; }
    public SelfReserveSlotRequest Request { get; set; } = null!;
}
