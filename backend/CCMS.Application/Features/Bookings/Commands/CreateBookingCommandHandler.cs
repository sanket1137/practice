using AutoMapper;
using CCMS.Application.Interfaces;
using CCMS.Application.Services;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Bookings;
using MediatR;

namespace CCMS.Application.Features.Bookings.Commands;

public class CreateBookingCommandHandler : IRequestHandler<CreateBookingCommand, BookingDto>
{
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Campaign> _campaignRepository;
    private readonly IRepository<Creative> _creativeRepository;
    private readonly IRepository<User> _userRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly BookingCalculationService _calculationService;
    private readonly CreativeValidationService _validationService;
    private readonly SlotAvailabilityService _slotAvailabilityService;
    private readonly IBookingNotificationService _notificationService;

    public CreateBookingCommandHandler(
        IRepository<Booking> bookingRepository,
        IRepository<Screen> screenRepository,
        IRepository<Campaign> campaignRepository,
        IRepository<Creative> creativeRepository,
        IRepository<User> userRepository,
        IUnitOfWork unitOfWork,
        IMapper mapper,
        BookingCalculationService calculationService,
        CreativeValidationService validationService,
        SlotAvailabilityService slotAvailabilityService,
        IBookingNotificationService notificationService)
    {
        _bookingRepository = bookingRepository;
        _screenRepository = screenRepository;
        _campaignRepository = campaignRepository;
        _creativeRepository = creativeRepository;
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _calculationService = calculationService;
        _validationService = validationService;
        _slotAvailabilityService = slotAvailabilityService;
        _notificationService = notificationService;
    }

    public async Task<BookingDto> Handle(CreateBookingCommand request, CancellationToken cancellationToken)
    {
        // Parse date strings to DateOnly (no timezone issues - dates are dates!)
        if (!DateOnly.TryParse(request.Request.StartDate, out var startDate))
            throw new InvalidOperationException($"Invalid start date format: {request.Request.StartDate}. Expected YYYY-MM-DD.");
        
        if (!DateOnly.TryParse(request.Request.EndDate, out var endDate))
            throw new InvalidOperationException($"Invalid end date format: {request.Request.EndDate}. Expected YYYY-MM-DD.");

        // Validate entities exist
        var screen = await _screenRepository.GetByIdAsync(request.Request.ScreenId, cancellationToken);
        if (screen == null)
            throw new KeyNotFoundException("Screen not found");

        // Block bookings on unverified screens
        if (screen.VerificationStatus != ScreenVerificationStatus.Verified)
            throw new InvalidOperationException(
                "This screen has not been verified yet. Only verified screens can accept bookings.");

        // Lifecycle gate: only Active screens are open for booking. Paused,
        // Maintenance and pre-launch states must never take new demand.
        if (screen.Status != ScreenStatus.Active)
            throw new InvalidOperationException(
                $"This screen is not open for booking right now (status: {screen.Status}).");

        // Check screen owner visibility — private owners reject public bookings
        var screenOwner = await _userRepository.GetByIdAsync(screen.OwnerId, cancellationToken);
        if (screenOwner != null && screenOwner.AccountVisibility == ScreenVisibility.Private)
        {
            // Allow if the booking creator is the screen owner themselves
            var campaign2 = await _campaignRepository.GetByIdAsync(request.Request.CampaignId, cancellationToken);
            if (campaign2 == null || campaign2.AdvertiserId != screen.OwnerId)
                throw new InvalidOperationException("This screen owner is not accepting public bookings");
        }

        var campaign = await _campaignRepository.GetByIdAsync(request.Request.CampaignId, cancellationToken);
        if (campaign == null)
            throw new KeyNotFoundException("Campaign not found");

        // Campaign date range enforcement (simple date comparison - no timezone issues!)
        if (startDate < campaign.StartDate)
        {
            throw new InvalidOperationException(
                $"Booking start date ({startDate:yyyy-MM-dd}) must be on or after campaign start date ({campaign.StartDate:yyyy-MM-dd}).");
        }

        if (campaign.EndDate.HasValue && endDate > campaign.EndDate.Value)
        {
            throw new InvalidOperationException(
                $"Booking end date ({endDate:yyyy-MM-dd}) must be on or before campaign end date ({campaign.EndDate.Value:yyyy-MM-dd}).");
        }

        var creative = await _creativeRepository.GetByIdAsync(request.Request.CreativeId, cancellationToken);
        if (creative == null)
            throw new KeyNotFoundException("Creative not found");

        // STEP 1: Validate creative compatibility with screen
        var validation = await _validationService.ValidateCreativeForScreen(
            creative.Id, 
            screen.Id, 
            cancellationToken);

        if (!validation.IsCompatible)
        {
            throw new InvalidOperationException(
                $"Creative is not compatible with screen: {string.Join(", ", validation.Errors)}");
        }

        // Currency mismatch validation
        if (campaign.Currency != screen.Currency)
        {
            throw new InvalidOperationException(
                $"Currency mismatch: Campaign uses {campaign.Currency} but screen prices in {screen.Currency}. " +
                $"Please select a screen with {campaign.Currency} pricing or update the campaign currency.");
        }

        // STEP 2: Determine slot number (auto-assign or use specified)
        int slotNumber;
        if (request.Request.SlotNumber.HasValue)
        {
            // Validate specified slot is available
            slotNumber = request.Request.SlotNumber.Value;
            var isAvailable = await _slotAvailabilityService.IsSlotAvailable(
                screen.Id,
                slotNumber,
                startDate.ToDateTime(TimeOnly.MinValue),
                endDate.ToDateTime(TimeOnly.MinValue),
                cancellationToken);

            if (!isAvailable)
            {
                throw new InvalidOperationException(
                    $"Slot {slotNumber} is not available for the selected date range");
            }
        }
        else
        {
            // Auto-assign first available slot (allows partial availability)
            var availableSlot = await _slotAvailabilityService.FindPartiallyAvailableSlot(
                screen.Id,
                startDate.ToDateTime(TimeOnly.MinValue),
                endDate.ToDateTime(TimeOnly.MinValue),
                cancellationToken);

            if (!availableSlot.HasValue)
            {
                throw new InvalidOperationException(
                    "No available slots for the selected date range. All slots are fully booked on all days.");
            }

            slotNumber = availableSlot.Value;
        }

        // STEP 3: Calculate expected impressions and price (with availability checking)
        var calculation = await _calculationService.CalculateBookingWithAvailability(
            screen,
            slotNumber,  // Now we know the slot number
            startDate.ToDateTime(TimeOnly.MinValue),
            endDate.ToDateTime(TimeOnly.MinValue),
            _slotAvailabilityService,
            cancellationToken
        );

        // Validate that there are bookable days
        if (calculation.BookableDays == 0)
            throw new InvalidOperationException(
                "No available slots found for the selected date range. All days are sold out.");

        // Use parsed DateOnly values directly
        var bookingStartDate = startDate;
        var bookingEndDate = endDate;

        // CORRECTED FORMULA: Use calculated cost from service
        // Cost = price_per_slot_per_minute × display_time_per_slot × total_frames
        var totalPrice = calculation.TotalCost;

        // Budget enforcement - Prevent overspending
        var existingBookings = await _bookingRepository.GetAllAsync(cancellationToken);
        var existingBookingsTotal = existingBookings
            .Where(b => b.CampaignId == request.Request.CampaignId && !b.IsDeleted)
            .Sum(b => b.TotalPrice);
            
        var proposedTotal = existingBookingsTotal + totalPrice;
        if (proposedTotal > campaign.Budget)
        {
            var remaining = campaign.Budget - existingBookingsTotal;
            throw new InvalidOperationException(
                $"Booking exceeds campaign budget. Budget: {campaign.Budget:F2} {campaign.Currency}, Already spent: {existingBookingsTotal:F2}, This booking: {totalPrice:F2}, Remaining: {remaining:F2}. Please (1) increase budget, (2) reduce date range, or (3) select a cheaper screen.");
        }

        // Get list of dates that have available slots (for partial booking tracking)
        var bookedDates = calculation.DailyBreakdown
            .Where(d => d.IsAvailable && d.Frames > 0)
            .Select(d => d.Date)
            .ToList();

        // Create daily slot assignments dictionary for partial booking tracking
        var dailySlotAssignments = bookedDates.ToDictionary(
            date => date,
            date => slotNumber  // Assign the same slot for all dates (will be finalized on approval)
        );

        // STEP 4: Create booking entity
        var autoApprove = screen.AutoApprovalEnabled;
        var booking = new Booking
        {
            ScreenId = request.Request.ScreenId,
            CampaignId = request.Request.CampaignId,
            CreativeId = request.Request.CreativeId,
            StartDate = bookingStartDate,
            EndDate = bookingEndDate,
            SlotNumbers = new List<int> { slotNumber },
            Status = autoApprove ? Domain.Enums.BookingStatus.Approved : Domain.Enums.BookingStatus.Pending,
            ExpectedImpressions = calculation.TotalExpectedImpressions,
            DeliveredImpressions = 0,
            TotalPrice = totalPrice,
            Currency = screen.Currency,
            FitMode = request.Request.FitMode
                ?? validation.SuggestedFitMode
                ?? Domain.Enums.CreativeFitMode.SmartAdaptive,
            DailySlotAssignments = dailySlotAssignments,
            CancelGraceExpiresAt = autoApprove ? DateTime.UtcNow.AddHours(2) : null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // STEP 5: Save booking (NO SLOT BOOKING YET - reserved on approval)
        await _bookingRepository.AddAsync(booking, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // REMOVED: BookSlot call - slots are now reserved only when booking is approved
        // This allows multiple pending bookings and shows accurate availability

        var bookingDto = _mapper.Map<BookingDto>(booking);

        // STEP 6: Notify screen owner of new booking via SignalR
        try
        {
            await _notificationService.NotifyBookingCreatedAsync(bookingDto, screen.OwnerId);
        }
        catch (Exception)
        {
            // Don't fail the booking creation if notification fails
        }

        return bookingDto;
    }
}
