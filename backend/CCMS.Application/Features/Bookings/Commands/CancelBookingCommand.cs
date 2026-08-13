using MediatR;
using CCMS.Shared.DTOs.Bookings;

namespace CCMS.Application.Features.Bookings.Commands;

public record CancelBookingCommand(
    Guid BookingId,
    Guid UserId,
    string? CancellationReason
) : IRequest<BookingDto>;
