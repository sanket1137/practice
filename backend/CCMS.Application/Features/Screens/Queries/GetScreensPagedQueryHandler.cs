using AutoMapper;
using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Domain.Enums;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Features.Screens.Queries;

/// <summary>
/// Handler for GetScreensPagedQuery - returns paginated list of screens.
/// </summary>
public class GetScreensPagedQueryHandler : IRequestHandler<GetScreensPagedQuery, PagedResult<ScreenDto>>
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<User> _userRepository;
    private readonly IMapper _mapper;

    public GetScreensPagedQueryHandler(
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

    public async Task<PagedResult<ScreenDto>> Handle(GetScreensPagedQuery request, CancellationToken cancellationToken)
    {
        // Ensure valid pagination parameters
        var pageNumber = Math.Max(1, request.PageNumber);
        var pageSize = Math.Clamp(request.PageSize, 1, 100); // Limit max page size to 100
        
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
        
        // Apply search filter
        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchLower = request.SearchTerm.ToLowerInvariant();
            screens = screens.Where(s => 
                (s.Name != null && s.Name.ToLowerInvariant().Contains(searchLower)) ||
                (s.Location != null && s.Location.City != null && s.Location.City.ToLowerInvariant().Contains(searchLower)) ||
                (s.Location != null && s.Location.Street != null && s.Location.Street.ToLowerInvariant().Contains(searchLower)) ||
                (s.Description != null && s.Description.ToLowerInvariant().Contains(searchLower)));
        }
        
        // Apply status filter
        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            if (Enum.TryParse<ScreenStatus>(request.Status, true, out var status))
            {
                screens = screens.Where(s => s.Status == status);
            }
        }
        
        // Apply sorting
        screens = request.SortBy?.ToLowerInvariant() switch
        {
            "name" => request.SortDirection?.ToLowerInvariant() == "asc" 
                ? screens.OrderBy(s => s.Name) 
                : screens.OrderByDescending(s => s.Name),
            "location" or "address" => request.SortDirection?.ToLowerInvariant() == "asc" 
                ? screens.OrderBy(s => s.Location != null ? s.Location.City : string.Empty) 
                : screens.OrderByDescending(s => s.Location != null ? s.Location.City : string.Empty),
            _ => request.SortDirection?.ToLowerInvariant() == "asc" 
                ? screens.OrderBy(s => s.CreatedAt) 
                : screens.OrderByDescending(s => s.CreatedAt)
        };
        
        // Get total count before pagination
        var screensList = screens.ToList();
        var totalCount = screensList.Count;
        
        // Apply pagination
        var pagedScreens = screensList
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToList();
        
        // Map to DTOs
        var screenDtos = _mapper.Map<List<ScreenDto>>(pagedScreens);
        
        // Enrich with booking data (only for the current page)
        var allBookings = await _bookingRepository.GetAllAsync();
        
        foreach (var screenDto in screenDtos)
        {
            var approvedBookings = allBookings
                .Where(b => b.ScreenId == screenDto.Id && 
                           !b.IsDeleted &&
                           (b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active))
                .ToList();

            if (approvedBookings.Any())
            {
                var todayDateOnly = DateOnly.FromDateTime(DateTime.Today);
                var activeToday = approvedBookings
                    .Where(b => b.StartDate <= todayDateOnly && b.EndDate >= todayDateOnly)
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
                screenDto.RevenueEstimate = null;
                screenDto.BookedSlots = 0;
                screenDto.ActiveBookings = 0;
            }
        }

        return new PagedResult<ScreenDto>
        {
            Items = screenDtos,
            TotalCount = totalCount,
            PageNumber = pageNumber,
            PageSize = pageSize
        };
    }
}
