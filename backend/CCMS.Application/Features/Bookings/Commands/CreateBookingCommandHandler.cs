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

    public CreateBookingCommandHandler(
        IRepository<Booking> bookingRepository,
        IRepository<Screen> screenRepository,
        IRepository<Campaign> campaignRepository,
        IRepository<Creative> creativeRepository,
        IUnitOfWork unitOfWork,
        IMapper mapper,
        BookingCalculationService calculationService)
    {
        _bookingRepository = bookingRepository;
        _screenRepository = screenRepository;
        _campaignRepository = campaignRepository;
        _creativeRepository = creativeRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _calculationService = calculationService;
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

        // Calculate expected impressions based on date range and schedule
        var calculation = _calculationService.CalculateBooking(
            screen,
            request.Request.StartDate,
            request.Request.EndDate
        );

        // Validate that screen operates during the selected period
        if (calculation.OperatingDays == 0)
            throw new InvalidOperationException("Screen does not operate during the selected date range");

        // Calculate total price (per-minute pricing)
        // PricePerSlot is now per minute, and each impression = 1 minute of operating time
        var totalPrice = screen.PricePerSlot * calculation.TotalExpectedImpressions;

        var booking = new Booking
        {
            ScreenId = request.Request.ScreenId,
            CampaignId = request.Request.CampaignId,
            CreativeId = request.Request.CreativeId,
            StartDate = request.Request.StartDate,
            EndDate = request.Request.EndDate,
            SlotNumbers = new List<int> { 1 }, // Fixed: always slot 1 per advertiser
            Status = Domain.Enums.BookingStatus.Pending,
            ExpectedImpressions = calculation.TotalExpectedImpressions,
            DeliveredImpressions = 0,
            TotalPrice = totalPrice,
            Currency = screen.Currency,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _bookingRepository.AddAsync(booking, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<BookingDto>(booking);
    }
}
