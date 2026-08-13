using AutoMapper;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Domain.Enums;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Bookings;
using MediatR;

namespace CCMS.Application.Features.Bookings.Queries;

/// <summary>
/// Handler for GetBookingsPagedQuery - returns paginated list of bookings.
/// </summary>
public class GetBookingsPagedQueryHandler : IRequestHandler<GetBookingsPagedQuery, PagedResult<BookingDto>>
{
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Impression> _impressionRepository;
    private readonly IMapper _mapper;

    public GetBookingsPagedQueryHandler(
        IRepository<Booking> bookingRepository,
        IRepository<Screen> screenRepository,
        IRepository<Impression> impressionRepository,
        IMapper mapper)
    {
        _bookingRepository = bookingRepository;
        _screenRepository = screenRepository;
        _impressionRepository = impressionRepository;
        _mapper = mapper;
    }

    public async Task<PagedResult<BookingDto>> Handle(GetBookingsPagedQuery request, CancellationToken cancellationToken)
    {
        // Ensure valid pagination parameters
        var pageNumber = Math.Max(1, request.PageNumber);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        
        var allBookings = (await _bookingRepository.GetAllAsync(cancellationToken)).ToList();

        // Filter by advertiser if specified
        if (request.UserId.HasValue)
        {
            allBookings = allBookings.Where(b => 
                b.Campaign != null && b.Campaign.AdvertiserId == request.UserId.Value
            ).ToList();
        }

        // Filter by screen owner if specified
        if (request.ScreenOwnerId.HasValue)
        {
            var ownerScreenIds = (await _screenRepository.GetAllAsync(cancellationToken))
                .Where(s => s.OwnerId == request.ScreenOwnerId.Value)
                .Select(s => s.Id)
                .ToList();

            allBookings = allBookings.Where(b => ownerScreenIds.Contains(b.ScreenId)).ToList();
        }

        // Filter by campaign if specified
        if (request.CampaignId.HasValue)
        {
            allBookings = allBookings.Where(b => b.CampaignId == request.CampaignId.Value).ToList();
        }

        // Filter by specific screen
        if (request.ScreenId.HasValue)
        {
            allBookings = allBookings.Where(b => b.ScreenId == request.ScreenId.Value).ToList();
        }
        
        // Apply status filter
        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            if (Enum.TryParse<BookingStatus>(request.Status, true, out var status))
            {
                allBookings = allBookings.Where(b => b.Status == status).ToList();
            }
        }
        
        // Apply search filter
        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchLower = request.SearchTerm.ToLowerInvariant();
            allBookings = allBookings.Where(b => 
                (b.Campaign?.Name != null && b.Campaign.Name.ToLowerInvariant().Contains(searchLower)) ||
                (b.Screen?.Name != null && b.Screen.Name.ToLowerInvariant().Contains(searchLower))).ToList();
        }

        // Apply sorting
        IEnumerable<Booking> sortedBookings = request.SortBy?.ToLowerInvariant() switch
        {
            "startdate" => request.SortDirection?.ToLowerInvariant() == "asc" 
                ? allBookings.OrderBy(b => b.StartDate) 
                : allBookings.OrderByDescending(b => b.StartDate),
            "enddate" => request.SortDirection?.ToLowerInvariant() == "asc" 
                ? allBookings.OrderBy(b => b.EndDate) 
                : allBookings.OrderByDescending(b => b.EndDate),
            "status" => request.SortDirection?.ToLowerInvariant() == "asc" 
                ? allBookings.OrderBy(b => b.Status) 
                : allBookings.OrderByDescending(b => b.Status),
            _ => request.SortDirection?.ToLowerInvariant() == "asc" 
                ? allBookings.OrderBy(b => b.CreatedAt) 
                : allBookings.OrderByDescending(b => b.CreatedAt)
        };

        var bookingsList = sortedBookings.ToList();
        var totalCount = bookingsList.Count;

        // Apply pagination
        var pagedBookings = bookingsList
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var bookingDtos = _mapper.Map<List<BookingDto>>(pagedBookings);

        // Populate dateBreakdown for each booking
        foreach (var dto in bookingDtos)
        {
            var booking = pagedBookings.First(b => b.Id == dto.Id);
            
            if (booking.DailySlotAssignments != null && booking.DailySlotAssignments.Any())
            {
                var bookedDates = booking.DailySlotAssignments.Keys.OrderBy(d => d).ToList();
                var bookedDateOnly = bookedDates.Select(d => DateOnly.FromDateTime(d)).ToList();
                dto.BookedDates = bookedDateOnly.Select(d => d.ToString("yyyy-MM-dd")).ToList();

                var totalDays = booking.EndDate.DayNumber - booking.StartDate.DayNumber + 1;
                
                var requestedDates = new List<DateOnly>();
                var currentDate = booking.StartDate;
                while (currentDate <= booking.EndDate)
                {
                    requestedDates.Add(currentDate);
                    currentDate = currentDate.AddDays(1);
                }

                var unavailableDates = requestedDates.Except(bookedDateOnly).ToList();

                dto.DateBreakdown = new BookingDateBreakdown
                {
                    RequestedDates = requestedDates.Select(d => d.ToString("yyyy-MM-dd")).ToList(),
                    AvailableDates = bookedDateOnly.Select(d => d.ToString("yyyy-MM-dd")).ToList(),
                    UnavailableDates = unavailableDates.Select(d => d.ToString("yyyy-MM-dd")).ToList(),
                    TotalRequested = totalDays,
                    TotalAvailable = bookedDateOnly.Count,
                    TotalUnavailable = unavailableDates.Count,
                    IsPartialBooking = bookedDateOnly.Count < totalDays
                };
            }
        }
        
        // Populate play counts and live status
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var now = DateTime.UtcNow;
        
        foreach (var dto in bookingDtos)
        {
            var booking = pagedBookings.First(b => b.Id == dto.Id);
            
            var impressions = await _impressionRepository
                .FindAsync(i => i.BookingId == dto.Id, cancellationToken);
            
            if (impressions.Any())
            {
                var impressionsList = impressions.ToList();
                dto.PlaysToday = impressionsList.Count(i => DateOnly.FromDateTime(i.SessionDate) == today);
                dto.PlaysTotal = impressionsList.Count;
                dto.LastPlayed = impressionsList.Max(i => i.PlayedAt);
            }
            
            var screen = await _screenRepository.GetByIdAsync(dto.ScreenId, cancellationToken);
            dto.IsLive = screen?.IsOnline == true && 
                        booking.Status == BookingStatus.Approved &&
                        today >= booking.StartDate && 
                        today <= booking.EndDate;
        }

        return new PagedResult<BookingDto>
        {
            Items = bookingDtos,
            TotalCount = totalCount,
            PageNumber = pageNumber,
            PageSize = pageSize
        };
    }
}
