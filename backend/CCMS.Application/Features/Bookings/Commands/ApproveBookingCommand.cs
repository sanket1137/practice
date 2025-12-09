using MediatR;
using CCMS.Shared.DTOs.Bookings;

namespace CCMS.Application.Features.Bookings.Commands;

public record ApproveBookingCommand(Guid BookingId, Guid UserId) : IRequest<BookingDto>;
