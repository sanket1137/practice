using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Features.Screens.Queries;

public class GetSlotCalendarQueryHandler : IRequestHandler<GetSlotCalendarQuery, SlotCalendarDto>
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Campaign> _campaignRepository;

    public GetSlotCalendarQueryHandler(
        IRepository<Screen> screenRepository,
        IRepository<Booking> bookingRepository,
        IRepository<Campaign> campaignRepository)
    {
        _screenRepository = screenRepository;
        _bookingRepository = bookingRepository;
        _campaignRepository = campaignRepository;
    }

    public async Task<SlotCalendarDto> Handle(GetSlotCalendarQuery request, CancellationToken cancellationToken)
    {
        var screen = await _screenRepository.GetByIdAsync(request.ScreenId, cancellationToken);
        if (screen == null)
            throw new KeyNotFoundException($"Screen {request.ScreenId} not found");

        // Get all bookings for this screen in the date range
        var allBookings = (await _bookingRepository.GetAllAsync(cancellationToken))
            .Where(b => b.ScreenId == request.ScreenId && 
                       b.StartDate <= request.EndDate &&
                       b.EndDate >= request.StartDate &&
                       (b.Status == Domain.Enums.BookingStatus.Approved || 
                        b.Status == Domain.Enums.BookingStatus.Active ||
                        b.Status == Domain.Enums.BookingStatus.Completed))
            .ToList();

        // Campaign name + advertiser per booking. The Campaign navigation is
        // never loaded by the repository, so the old booking.Campaign?.Name
        // lookup always fell back to "Unknown Campaign" — resolve explicitly.
        var campaignIds = allBookings
            .Where(b => b.CampaignId.HasValue)
            .Select(b => b.CampaignId!.Value)
            .Distinct()
            .ToList();
        var campaigns = (await _campaignRepository.FindAsync(
                c => campaignIds.Contains(c.Id), cancellationToken))
            .ToDictionary(c => c.Id, c => new { c.Name, c.AdvertiserId });

        bool IsRequesters(Booking b)
        {
            if (request.RequesterId == null) return false;
            if (b.CampaignId.HasValue && campaigns.TryGetValue(b.CampaignId.Value, out var c)
                && c.AdvertiserId == request.RequesterId.Value) return true;
            // The owner's own reservation on their own screen.
            return screen.OwnerId == request.RequesterId.Value
                   && b.Source == Domain.Enums.BookingSource.SelfReserved;
        }

        var calendar = new SlotCalendarDto
        {
            ScreenId = screen.Id,
            ScreenName = screen.Name,
            SlotsPerFrame = screen.SlotsPerFrame,
            Days = new List<CalendarDayDto>()
        };

        // Generate calendar for each day in range
        var currentDate = request.StartDate;
        while (currentDate <= request.EndDate)
        {
            var dayOfWeek = currentDate.DayOfWeek;
            var daySchedule = GetDaySchedule(screen.Schedule, dayOfWeek);
            
            var dayDto = new CalendarDayDto
            {
                Date = currentDate.ToDateTime(TimeOnly.MinValue),
                IsOperating = daySchedule?.IsOperating ?? false,
                Slots = new List<CalendarSlotDto>()
            };

            if (daySchedule?.IsOperating == true)
            {
                // Create slot status for each slot
                for (int slotNum = 1; slotNum <= screen.SlotsPerFrame; slotNum++)
                {
                    var slotDto = new CalendarSlotDto
                    {
                        SlotNumber = slotNum,
                        Status = "available"
                    };

                    // Check if this slot is booked on this date
                    var booking = allBookings.FirstOrDefault(b =>
                    {
                        // PRIMARY CHECK: Use DailySlotAssignments which stores actual local dates
                        if (b.DailySlotAssignments != null)
                        {
                            if (b.DailySlotAssignments.TryGetValue(currentDate.ToDateTime(TimeOnly.MinValue), out var slotForDay))
                            {
                                return slotForDay == slotNum;
                            }
                            // If DailySlotAssignments exists but doesn't have this date, not booked
                            return false;
                        }

                        // FALLBACK: For legacy bookings without DailySlotAssignments
                        if (b.StartDate > currentDate || b.EndDate < currentDate)
                            return false;

                        // Check SlotNumbers for legacy bookings
                        return b.SlotNumbers != null && b.SlotNumbers.Any(s => s == slotNum);
                    });

                    if (booking != null)
                    {
                        slotDto.Status = "booked";
                        slotDto.BookingId = booking.Id;
                        slotDto.CampaignName = booking.CampaignId.HasValue
                            && campaigns.TryGetValue(booking.CampaignId.Value, out var c)
                                ? c.Name
                                : (booking.Source == Domain.Enums.BookingSource.SelfReserved
                                    ? "Owner reservation" : "Direct booking");
                        slotDto.IsMine = IsRequesters(booking);
                    }

                    dayDto.Slots.Add(slotDto);
                }
            }

            calendar.Days.Add(dayDto);
            currentDate = currentDate.AddDays(1);
        }

        return calendar;
    }

    private Domain.ValueObjects.DaySchedule? GetDaySchedule(
        Domain.ValueObjects.OperatingSchedule schedule, 
        DayOfWeek dayOfWeek)
    {
        return dayOfWeek switch
        {
            DayOfWeek.Monday => schedule.Monday,
            DayOfWeek.Tuesday => schedule.Tuesday,
            DayOfWeek.Wednesday => schedule.Wednesday,
            DayOfWeek.Thursday => schedule.Thursday,
            DayOfWeek.Friday => schedule.Friday,
            DayOfWeek.Saturday => schedule.Saturday,
            DayOfWeek.Sunday => schedule.Sunday,
            _ => null
        };
    }
}
