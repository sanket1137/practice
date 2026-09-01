using AutoMapper;
using CCMS.Application.Services;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Bookings;
using MediatR;

namespace CCMS.Application.Features.Bookings.Commands;

public class SelfReserveSlotCommandHandler : IRequestHandler<SelfReserveSlotCommand, BookingDto>
{
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Creative> _creativeRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly SlotAvailabilityService _slotAvailabilityService;
    private readonly BookingCalculationService _calculationService;

    public SelfReserveSlotCommandHandler(
        IRepository<Booking> bookingRepository,
        IRepository<Screen> screenRepository,
        IRepository<Creative> creativeRepository,
        IUnitOfWork unitOfWork,
        IMapper mapper,
        SlotAvailabilityService slotAvailabilityService,
        BookingCalculationService calculationService)
    {
        _bookingRepository = bookingRepository;
        _screenRepository = screenRepository;
        _creativeRepository = creativeRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _slotAvailabilityService = slotAvailabilityService;
        _calculationService = calculationService;
    }

    public async Task<BookingDto> Handle(SelfReserveSlotCommand request, CancellationToken cancellationToken)
    {
        if (!DateOnly.TryParse(request.Request.StartDate, out var startDate))
            throw new InvalidOperationException($"Invalid start date format: {request.Request.StartDate}. Expected YYYY-MM-DD.");

        if (!DateOnly.TryParse(request.Request.EndDate, out var endDate))
            throw new InvalidOperationException($"Invalid end date format: {request.Request.EndDate}. Expected YYYY-MM-DD.");

        var screen = await _screenRepository.GetByIdAsync(request.Request.ScreenId, cancellationToken);
        if (screen == null)
            throw new KeyNotFoundException("Screen not found");

        // Must be the screen owner
        if (screen.OwnerId != request.UserId)
            throw new UnauthorizedAccessException("Only the screen owner can self-reserve slots");

        // Owners may reserve on a screen that is open (Active) or verified and
        // about to open (Ready) — e.g. loading house promos before launch.
        // Draft/pending/paused/archived screens can't hold reservations.
        if (screen.Status is not (ScreenStatus.Active or ScreenStatus.Ready))
            throw new InvalidOperationException(
                $"Slots can only be reserved while the screen is Ready or Active (current status: {screen.Status}).");

        var creative = await _creativeRepository.GetByIdAsync(request.Request.CreativeId, cancellationToken);
        if (creative == null)
            throw new KeyNotFoundException("Creative not found");

        // Determine slot number
        int slotNumber;
        if (request.Request.SlotNumber.HasValue)
        {
            slotNumber = request.Request.SlotNumber.Value;
            var isAvailable = await _slotAvailabilityService.IsSlotAvailable(
                screen.Id, slotNumber,
                startDate.ToDateTime(TimeOnly.MinValue),
                endDate.ToDateTime(TimeOnly.MinValue),
                cancellationToken);

            if (!isAvailable)
                throw new InvalidOperationException($"Slot {slotNumber} is not available for the selected date range");
        }
        else
        {
            var availableSlot = await _slotAvailabilityService.FindPartiallyAvailableSlot(
                screen.Id,
                startDate.ToDateTime(TimeOnly.MinValue),
                endDate.ToDateTime(TimeOnly.MinValue),
                cancellationToken);

            if (!availableSlot.HasValue)
                throw new InvalidOperationException("No available slots for the selected date range");

            slotNumber = availableSlot.Value;
        }

        // Calculate expected impressions + price
        var calculation = await _calculationService.CalculateBookingWithAvailability(
            screen, slotNumber,
            startDate.ToDateTime(TimeOnly.MinValue),
            endDate.ToDateTime(TimeOnly.MinValue),
            _slotAvailabilityService,
            cancellationToken);

        if (calculation.BookableDays == 0)
            throw new InvalidOperationException("No available slots found for the selected date range");

        var bookedDates = calculation.DailyBreakdown
            .Where(d => d.IsAvailable && d.Frames > 0)
            .Select(d => d.Date)
            .ToList();

        var dailySlotAssignments = bookedDates.ToDictionary(
            date => date,
            date => slotNumber);

        var totalPrice = request.Request.Price ?? calculation.TotalCost;

        var booking = new Booking
        {
            ScreenId = request.Request.ScreenId,
            CampaignId = null,
            CreativeId = request.Request.CreativeId,
            StartDate = startDate,
            EndDate = endDate,
            SlotNumbers = new List<int> { slotNumber },
            Status = BookingStatus.Approved,
            PaymentStatus = PaymentStatus.Captured,
            ExpectedImpressions = calculation.TotalExpectedImpressions,
            DeliveredImpressions = 0,
            TotalPrice = totalPrice,
            Currency = screen.Currency,
            DailySlotAssignments = dailySlotAssignments,
            Source = BookingSource.SelfReserved,
            ClientName = request.Request.ClientName,
            ClientContact = request.Request.ClientContact,
            InternalNotes = request.Request.InternalNotes,
            IsInternalPayment = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            ApprovedAt = DateTime.UtcNow
        };

        await _bookingRepository.AddAsync(booking, cancellationToken);

        // Book the slot immediately (self-reserved = pre-approved)
        await _slotAvailabilityService.BookSlot(
            screen.Id, slotNumber, booking.Id,
            startDate.ToDateTime(TimeOnly.MinValue),
            endDate.ToDateTime(TimeOnly.MinValue),
            cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<BookingDto>(booking);
    }
}
