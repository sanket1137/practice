using MediatR;
using CCMS.Shared.DTOs.Bookings;

namespace CCMS.Application.Features.Bookings.Commands;

public record RejectBookingCommand(
    Guid BookingId,
    Guid UserId,
    string RejectionReason
) : IRequest<BookingDto>;
