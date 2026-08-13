using AutoMapper;
using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Domain.Enums;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Features.Screens.Queries;

public class GetScreensQueryHandler : IRequestHandler<GetScreensQuery, IEnumerable<ScreenDto>>
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<User> _userRepository;
    private readonly IMapper _mapper;

    public GetScreensQueryHandler(
        IRepository<Screen> screenRepository, 
        IRepository<Booking> bookingRepository,
        IRepository<User> userRepository,
        IMapper mapper)
    {
        _screenRepository = screenRepository;
        _bookingRepository = bookingRepository;
        _userRepository = userRepository;
        _mapper = mapper;
    }

    public async Task<IEnumerable<ScreenDto>> Handle(GetScreensQuery request, CancellationToken cancellationToken)
    {
        var screens = await _screenRepository.GetAllAsync();
        
        // Filter by owner if specified (for screen owners viewing their own screens)
        if (request.OwnerId.HasValue)
        {
            screens = screens.Where(s => s.OwnerId == request.OwnerId.Value);
        }

        // Advertisers can only see screens from Public accounts
        if (request.CallerRole == "Advertiser")
        {
            var allUsers = await _userRepository.GetAllAsync();
            var privateOwnerIds = new HashSet<Guid>(
                allUsers.Where(u => u.AccountVisibility == ScreenVisibility.Private).Select(u => u.Id));

            if (privateOwnerIds.Count > 0)
            {
                screens = screens.Where(s => !privateOwnerIds.Contains(s.OwnerId));
            }
        }
        
        var screenDtos = _mapper.Map<IEnumerable<ScreenDto>>(screens).ToList();
        var allBookings = await _bookingRepository.GetAllAsync();

        // Calculate revenue estimate for each screen based on ACTIVE/APPROVED bookings only
        foreach (var screenDto in screenDtos)
        {
            // Get approved/active bookings for this screen (all dates, not just today)
            // This shows overall utilization including future bookings
            var approvedBookings = allBookings
                .Where(b => b.ScreenId == screenDto.Id && 
                           !b.IsDeleted &&
                           (b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active))
                .ToList();

            if (approvedBookings.Any())
            {
                // For revenue, only count bookings active today
                var todayDate = DateOnly.FromDateTime(DateTime.Today);
                var activeToday = approvedBookings
                    .Where(b => b.StartDate <= todayDate && b.EndDate >= todayDate)
                    .ToList();

                if (activeToday.Any())
                {
                    var totalRevenue = activeToday.Sum(b => b.TotalPrice);
                    screenDto.RevenueEstimate = new RevenueEstimateDto
                    {
                        Daily = new Dictionary<string, decimal>
                        {
                            { DateTime.Today.ToString("yyyy-MM-dd"), totalRevenue }
                        },
                        Weekly = totalRevenue * 7,
                        Monthly = totalRevenue * 30,
                        PerFrame = totalRevenue / (activeToday.Count > 0 ? activeToday.Count : 1),
                        PerHour = totalRevenue / 24
                    };
                }
                else
                {
                    screenDto.RevenueEstimate = null;
                }

                // Count ALL unique slot numbers across all approved bookings (any date)
                // This shows how many slots are booked in general
                var allSlotNumbers = approvedBookings
                    .Where(b => b.SlotNumbers != null && b.SlotNumbers.Any())
                    .SelectMany(b => b.SlotNumbers)
                    .Distinct()
                    .Count();

                screenDto.BookedSlots = allSlotNumbers;
                screenDto.ActiveBookings = approvedBookings.Count;
            }
            else
            {
                // No active bookings - set to null/0
                screenDto.RevenueEstimate = null;
                screenDto.BookedSlots = 0;
                screenDto.ActiveBookings = 0;
            }
        }

        return screenDtos;
    }
}
