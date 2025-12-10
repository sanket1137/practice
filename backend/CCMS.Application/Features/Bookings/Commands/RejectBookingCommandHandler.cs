using AutoMapper;
using CCMS.Application.Services;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Bookings;
using MediatR;

namespace CCMS.Application.Features.Bookings.Commands;

public class RejectBookingCommandHandler : IRequestHandler<RejectBookingCommand, BookingDto>
{
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly SlotAvailabilityService _slotAvailabilityService;

    public RejectBookingCommandHandler(
        IRepository<Booking> bookingRepository,
        IRepository<Screen> screenRepository,
        IUnitOfWork unitOfWork,
        IMapper mapper,
        SlotAvailabilityService slotAvailabilityService)
    {
        _bookingRepository = bookingRepository;
        _screenRepository = screenRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _slotAvailabilityService = slotAvailabilityService;
    }

    public async Task<BookingDto> Handle(RejectBookingCommand request, CancellationToken cancellationToken)
    {
        var booking = await _bookingRepository.GetByIdAsync(request.BookingId, cancellationToken);

        if (booking == null)
            throw new KeyNotFoundException("Booking not found");

        // Verify user owns the screen
        var screen = await _screenRepository.GetByIdAsync(booking.ScreenId, cancellationToken);
        if (screen == null || screen.OwnerId != request.UserId)
            throw new UnauthorizedAccessException("You can only reject bookings for your own screens");

        booking.Status = Domain.Enums.BookingStatus.Rejected;
        booking.RejectionReason = request.RejectionReason;
        booking.UpdatedAt = DateTime.UtcNow;

        // Release the booked slot
        if (booking.SlotNumbers != null && booking.SlotNumbers.Any())
        {
            var slotNumber = booking.SlotNumbers.First();
            await _slotAvailabilityService.ReleaseSlot(
                booking.ScreenId,
                slotNumber,
                booking.StartDate,
                booking.EndDate,
                cancellationToken);
        }

        await _bookingRepository.UpdateAsync(booking, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<BookingDto>(booking);
    }
}
