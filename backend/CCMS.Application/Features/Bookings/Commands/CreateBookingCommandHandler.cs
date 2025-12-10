using AutoMapper;
using CCMS.Application.Services;
using CCMS.Domain.Entities;
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
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly BookingCalculationService _calculationService;
    private readonly CreativeValidationService _validationService;
    private readonly SlotAvailabilityService _slotAvailabilityService;

    public CreateBookingCommandHandler(
        IRepository<Booking> bookingRepository,
        IRepository<Screen> screenRepository,
        IRepository<Campaign> campaignRepository,
        IRepository<Creative> creativeRepository,
        IUnitOfWork unitOfWork,
        IMapper mapper,
        BookingCalculationService calculationService,
        CreativeValidationService validationService,
        SlotAvailabilityService slotAvailabilityService)
    {
        _bookingRepository = bookingRepository;
        _screenRepository = screenRepository;
        _campaignRepository = campaignRepository;
        _creativeRepository = creativeRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _calculationService = calculationService;
        _validationService = validationService;
        _slotAvailabilityService = slotAvailabilityService;
    }

    public async Task<BookingDto> Handle(CreateBookingCommand request, CancellationToken cancellationToken)
    {
        // Validate entities exist
        var screen = await _screenRepository.GetByIdAsync(request.Request.ScreenId, cancellationToken);
        if (screen == null)
            throw new KeyNotFoundException("Screen not found");

        var campaign = await _campaignRepository.GetByIdAsync(request.Request.CampaignId, cancellationToken);
        if (campaign == null)
            throw new KeyNotFoundException("Campaign not found");

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

        // STEP 2: Determine slot number (auto-assign or use specified)
        int slotNumber;
        if (request.Request.SlotNumber.HasValue)
        {
            // Validate specified slot is available
            slotNumber = request.Request.SlotNumber.Value;
            var isAvailable = await _slotAvailabilityService.IsSlotAvailable(
                screen.Id,
                slotNumber,
                request.Request.StartDate,
                request.Request.EndDate,
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
                request.Request.StartDate,
                request.Request.EndDate,
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
            request.Request.StartDate,
            request.Request.EndDate,
            _slotAvailabilityService,
            cancellationToken
        );

        // Validate that there are bookable days
        if (calculation.BookableDays == 0)
            throw new InvalidOperationException(
                "No available slots found for the selected date range. All days are sold out.");

        // CORRECTED FORMULA: Use calculated cost from service
        // Cost = price_per_slot_per_minute × display_time_per_slot × total_frames
        var totalPrice = calculation.TotalCost;

        // STEP 4: Create booking entity
        var booking = new Booking
        {
            ScreenId = request.Request.ScreenId,
            CampaignId = request.Request.CampaignId,
            CreativeId = request.Request.CreativeId,
            StartDate = request.Request.StartDate,
            EndDate = request.Request.EndDate,
            SlotNumbers = new List<int> { slotNumber },
            Status = Domain.Enums.BookingStatus.Pending,
            ExpectedImpressions = calculation.TotalExpectedImpressions,
            DeliveredImpressions = 0,
            TotalPrice = totalPrice,
            Currency = screen.Currency,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // STEP 5: Save booking and book the slot (in transaction)
        await _bookingRepository.AddAsync(booking, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Book the slot after booking is created (so we have booking.Id)
        await _slotAvailabilityService.BookSlot(
            screen.Id,
            slotNumber,
            booking.Id,
            request.Request.StartDate,
            request.Request.EndDate,
            cancellationToken);

        return _mapper.Map<BookingDto>(booking);
    }
}
