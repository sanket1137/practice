using AutoMapper;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Bookings;
using MediatR;

namespace CCMS.Application.Features.Bookings.Queries;

public class GetBookingsQueryHandler : IRequestHandler<GetBookingsQuery, IEnumerable<BookingDto>>
{
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Impression> _impressionRepository;
    private readonly IMapper _mapper;

    public GetBookingsQueryHandler(
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

    public async Task<IEnumerable<BookingDto>> Handle(GetBookingsQuery request, CancellationToken cancellationToken)
    {
        // Get all bookings (navigation properties should be loaded by repository)
        var allBookings = (await _bookingRepository.GetAllAsync(cancellationToken)).ToList();

        // Filter by advertiser if specified (skip if Campaign is null)
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

        // Filter by specific screen if specified (for screen details page)
        if (request.ScreenId.HasValue)
        {
            allBookings = allBookings.Where(b => b.ScreenId == request.ScreenId.Value).ToList();
        }

        var bookingDtos = _mapper.Map<List<BookingDto>>(allBookings.OrderByDescending(b => b.CreatedAt));

        // DIAGNOSTIC: Log booking-screen relationships to identify mismatches
        foreach (var dto in bookingDtos)
        {
            var booking = allBookings.First(b => b.Id == dto.Id);
            Console.WriteLine($"[DIAGNOSTIC] Booking {booking.Id.ToString().Substring(0, 8)}: " +
                            $"ScreenId={booking.ScreenId.ToString().Substring(0, 8)}, " +
                            $"Screen.Name={booking.Screen?.Name ?? "NULL"}, " +
                            $"DTO.ScreenName={dto.ScreenName}, " +
                            $"Campaign={dto.CampaignName}");
        }

        // Populate dateBreakdown for each booking
        foreach (var dto in bookingDtos)
        {
            var booking = allBookings.First(b => b.Id == dto.Id);
            
            // If booking has daily slot assignments, use those for breakdown
            if (booking.DailySlotAssignments != null && booking.DailySlotAssignments.Any())
            {
                var bookedDates = booking.DailySlotAssignments.Keys.OrderBy(d => d).ToList();
                var bookedDateOnly = bookedDates.Select(d => DateOnly.FromDateTime(d)).ToList();
                dto.BookedDates = bookedDateOnly.Select(d => d.ToString("yyyy-MM-dd")).ToList();

                // Calculate total requested days
                var totalDays = booking.EndDate.DayNumber - booking.StartDate.DayNumber + 1;
                
                // Generate all requested dates
                var requestedDates = new List<DateOnly>();
                var currentDate = booking.StartDate;
                while (currentDate <= booking.EndDate)
                {
                    requestedDates.Add(currentDate);
                    currentDate = currentDate.AddDays(1);
                }

                // Find unavailable dates
                var unavailableDates = requestedDates.Except(bookedDateOnly).ToList();

                // Create breakdown
                dto.DateBreakdown = new BookingDateBreakdown
                {
                    RequestedDates = requestedDates.Select(d => d.ToString("yyyy-MM-dd")).ToList(),
                    AvailableDates = bookedDateOnly.Select(d => d.ToString("yyyy-MM-dd")).ToList(),
                    UnavailableDates = unavailableDates.Select(d => d.ToString("yyyy-MM-dd")).ToList(),
                    TotalRequested = totalDays,
                    TotalAvailable = bookedDateOnly.Count,
                    TotalUnavailable = unavailableDates.Count,
                    // Only partial if some REQUESTED days couldn't be booked
                    IsPartialBooking = bookedDateOnly.Count < totalDays
                };
            }
        }
        
        // Populate play counts and live status
        var today = DateTime.UtcNow.Date;
        var todayDate = DateOnly.FromDateTime(today);
        var now = DateTime.UtcNow;
        
        foreach (var dto in bookingDtos)
        {
            var booking = allBookings.First(b => b.Id == dto.Id);
            
            // Get impressions for this booking
            var impressions = await _impressionRepository
                .FindAsync(i => i.BookingId == dto.Id, cancellationToken);
            
            if (impressions.Any())
            {
                var impressionsList = impressions.ToList();
                
                // Plays today
                dto.PlaysToday = impressionsList.Count(i => i.SessionDate == today);
                
                // Total plays
                dto.PlaysTotal = impressionsList.Count;
                
                // Last played
                dto.LastPlayed = impressionsList.Max(i => i.PlayedAt);
            }
            
            // Is live: screen is online AND booking is currently active
            var screen = await _screenRepository.GetByIdAsync(dto.ScreenId, cancellationToken);
            dto.IsLive = screen?.IsOnline == true && 
                        booking.Status == CCMS.Domain.Enums.BookingStatus.Approved &&
                        todayDate >= booking.StartDate && 
                        todayDate <= booking.EndDate;
        }

        return bookingDtos;
    }
}
