using AutoMapper;
using CCMS.Application.Services;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Bookings;
using MediatR;
using System.Linq;

namespace CCMS.Application.Features.Bookings.Commands;

public class ApproveBookingCommandHandler : IRequestHandler<ApproveBookingCommand, BookingDto>
{
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Creative> _creativeRepository;
    private readonly SlotAvailabilityService _slotAvailabilityService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    public ApproveBookingCommandHandler(
        IRepository<Booking> bookingRepository,
        IRepository<Screen> screenRepository,
        IRepository<Creative> creativeRepository,
        SlotAvailabilityService slotAvailabilityService,
        IUnitOfWork unitOfWork,
        IMapper mapper)
    {
        _bookingRepository = bookingRepository;
        _screenRepository = screenRepository;
        _creativeRepository = creativeRepository;
        _slotAvailabilityService = slotAvailabilityService;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<BookingDto> Handle(ApproveBookingCommand request, CancellationToken cancellationToken)
    {
        var booking = await _bookingRepository.GetByIdAsync(request.BookingId, cancellationToken);

        if (booking == null)
            throw new KeyNotFoundException("Booking not found");

        // Verify user owns the screen
        var screen = await _screenRepository.GetByIdAsync(booking.ScreenId, cancellationToken);
        if (screen == null || screen.OwnerId != request.UserId)
            throw new UnauthorizedAccessException("You can only approve bookings for your own screens");

        // Ensure we have stored daily assignments for this booking (partial or full)
        if (booking.DailySlotAssignments == null || !booking.DailySlotAssignments.Any())
        {
            throw new InvalidOperationException("Booking does not contain daily slot assignments; cannot approve.");
        }

        // Reserve each assigned slot for its specific date
        var updatedAssignments = new Dictionary<DateTime, int>();
        foreach (var kvp in booking.DailySlotAssignments)
        {
            var date = kvp.Key;
            var slotNumber = kvp.Value;
            try
            {
                // Try to book the originally assigned slot
                await _slotAvailabilityService.BookSlot(
                    booking.ScreenId,
                    slotNumber,
                    booking.Id,
                    date,
                    date,
                    cancellationToken);
                updatedAssignments[date] = slotNumber;
            }
            catch (InvalidOperationException)
            {
                // Slot no longer available – find another free slot for this date
                var availableSlots = await _slotAvailabilityService.GetDayAvailableSlots(
                    booking.ScreenId,
                    date,
                    cancellationToken);
                if (!availableSlots.Any())
                {
                    throw new InvalidOperationException($"No free slots available on {date:yyyy-MM-dd} during approval.");
                }
                var newSlot = availableSlots.First();
                await _slotAvailabilityService.BookSlot(
                    booking.ScreenId,
                    newSlot,
                    booking.Id,
                    date,
                    date,
                    cancellationToken);
                updatedAssignments[date] = newSlot;
            }
        }

        // Persist any reassigned slots
        booking.DailySlotAssignments = updatedAssignments;
        booking.SlotNumbers = updatedAssignments.Values.Distinct().ToList();

        // Update booking status after successful slot reservations
        booking.Status = Domain.Enums.BookingStatus.Approved;
        booking.ApprovedBy = request.UserId;
        booking.ApprovedAt = DateTime.UtcNow;
        booking.UpdatedAt = DateTime.UtcNow;

        // Lock the creative to prevent editing/deletion
        var creative = await _creativeRepository.GetByIdAsync(booking.CreativeId, cancellationToken);
        if (creative != null)
        {
            creative.IsLocked = true;
            creative.LockedReason = $"Used in approved booking {booking.Id}";
            creative.UpdatedAt = DateTime.UtcNow;
            await _creativeRepository.UpdateAsync(creative, cancellationToken);
        }

        await _bookingRepository.UpdateAsync(booking, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<BookingDto>(booking);
    }
}
