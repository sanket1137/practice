using AutoMapper;
using CCMS.Application.Interfaces;
using CCMS.Application.Services;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Helpers;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Bookings;
using MediatR;

namespace CCMS.Application.Features.Bookings.Commands;

public class UpdateBookingDatesCommandHandler : IRequestHandler<UpdateBookingDatesCommand, BookingDto>
{
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Campaign> _campaignRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly BookingCalculationService _calculationService;
    private readonly SlotAvailabilityService _slotAvailabilityService;
    private readonly IBookingNotificationService _notificationService;

    public UpdateBookingDatesCommandHandler(
        IRepository<Booking> bookingRepository,
        IRepository<Screen> screenRepository,
        IRepository<Campaign> campaignRepository,
        IUnitOfWork unitOfWork,
        IMapper mapper,
        BookingCalculationService calculationService,
        SlotAvailabilityService slotAvailabilityService,
        IBookingNotificationService notificationService)
    {
        _bookingRepository = bookingRepository;
        _screenRepository = screenRepository;
        _campaignRepository = campaignRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _calculationService = calculationService;
        _slotAvailabilityService = slotAvailabilityService;
        _notificationService = notificationService;
    }

    public async Task<BookingDto> Handle(UpdateBookingDatesCommand request, CancellationToken cancellationToken)
    {
        // Parse new dates
        if (!DateOnly.TryParse(request.Request.NewStartDate, out var newStartDate))
            throw new InvalidOperationException($"Invalid start date format: {request.Request.NewStartDate}. Expected YYYY-MM-DD.");

        if (!DateOnly.TryParse(request.Request.NewEndDate, out var newEndDate))
            throw new InvalidOperationException($"Invalid end date format: {request.Request.NewEndDate}. Expected YYYY-MM-DD.");

        // New start date must be at least tomorrow
        var tomorrow = DateOnly.FromDateTime(DateTime.Today.AddDays(1));
        if (newStartDate < tomorrow)
            throw new InvalidOperationException("New start date must be at least tomorrow.");

        if (newEndDate < newStartDate)
            throw new InvalidOperationException("End date must be on or after start date.");

        // Fetch booking
        var booking = await _bookingRepository.GetByIdAsync(request.BookingId, cancellationToken);
        if (booking == null)
            throw new KeyNotFoundException("Booking not found");

        // Verify ownership: the user must own the campaign
        if (booking.CampaignId.HasValue)
        {
            var campaign = await _campaignRepository.GetByIdAsync(booking.CampaignId.Value, cancellationToken);
            if (campaign == null)
                throw new KeyNotFoundException("Campaign not found");

            if (campaign.AdvertiserId != request.UserId)
                throw new UnauthorizedAccessException("You can only update bookings for your own campaigns");

            // Validate against campaign date range
            if (newStartDate < campaign.StartDate)
                throw new InvalidOperationException(
                    $"New start date ({newStartDate:yyyy-MM-dd}) must be on or after campaign start date ({campaign.StartDate:yyyy-MM-dd}).");

            if (campaign.EndDate.HasValue && newEndDate > campaign.EndDate.Value)
                throw new InvalidOperationException(
                    $"New end date ({newEndDate:yyyy-MM-dd}) must be on or before campaign end date ({campaign.EndDate.Value:yyyy-MM-dd}).");
        }
        else
        {
            throw new InvalidOperationException("Cannot update dates for bookings without a campaign.");
        }

        // Only allow editing if status permits (Pending, Approved, or Rejected)
        if (!booking.Status.CanEdit())
            throw new InvalidOperationException(
                $"Cannot update dates for a booking in '{booking.Status.GetDisplayName()}' status.");

        // Fetch screen for slot/pricing recalculation
        var screen = await _screenRepository.GetByIdAsync(booking.ScreenId, cancellationToken);
        if (screen == null)
            throw new KeyNotFoundException("Screen not found");

        // Release any previously reserved slots (Approved bookings may have slots)
        if (booking.Status == BookingStatus.Approved)
        {
            await _slotAvailabilityService.UnbookSlot(booking.Id, cancellationToken);
        }

        // Find available slot for new date range 
        var slotNumber = booking.SlotNumbers.FirstOrDefault();
        if (slotNumber == 0) slotNumber = 1;

        var availableSlot = await _slotAvailabilityService.FindPartiallyAvailableSlot(
            screen.Id,
            newStartDate.ToDateTime(TimeOnly.MinValue),
            newEndDate.ToDateTime(TimeOnly.MinValue),
            cancellationToken);

        if (!availableSlot.HasValue)
            throw new InvalidOperationException(
                "No available slots for the new date range. All slots are fully booked.");

        slotNumber = availableSlot.Value;

        // Recalculate pricing
        var calculation = await _calculationService.CalculateBookingWithAvailability(
            screen,
            slotNumber,
            newStartDate.ToDateTime(TimeOnly.MinValue),
            newEndDate.ToDateTime(TimeOnly.MinValue),
            _slotAvailabilityService,
            cancellationToken);

        if (calculation.BookableDays == 0)
            throw new InvalidOperationException("No available slots found for the new date range.");

        // Build new daily slot assignments
        var bookedDates = calculation.DailyBreakdown
            .Where(d => d.IsAvailable && d.Frames > 0)
            .Select(d => d.Date)
            .ToList();

        var dailySlotAssignments = bookedDates.ToDictionary(
            date => date,
            _ => slotNumber
        );

        // Update booking fields
        var wasRejected = booking.Status == BookingStatus.Rejected;

        booking.StartDate = newStartDate;
        booking.EndDate = newEndDate;
        booking.TotalPrice = calculation.TotalCost;
        booking.ExpectedImpressions = calculation.TotalExpectedImpressions;
        booking.SlotNumbers = new List<int> { slotNumber };
        booking.DailySlotAssignments = dailySlotAssignments;
        booking.Status = BookingStatus.Pending; // Reset to Pending for re-approval
        booking.UpdatedAt = DateTime.UtcNow;

        // Clear rejection/cancellation fields if re-requesting
        if (wasRejected)
        {
            booking.RejectionReason = null;
        }
        booking.CancellationReason = null;
        booking.CancelledBy = null;
        booking.CancelledAt = null;

        await _bookingRepository.UpdateAsync(booking, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var bookingDto = _mapper.Map<BookingDto>(booking);

        // Notify screen owner about the re-request
        try
        {
            await _notificationService.NotifyBookingCreatedAsync(bookingDto, screen.OwnerId);
        }
        catch
        {
            // Notification is best-effort
        }

        return bookingDto;
    }
}
