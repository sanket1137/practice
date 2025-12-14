using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Features.Screens.Queries;

public class GetSlotCalendarQueryHandler : IRequestHandler<GetSlotCalendarQuery, SlotCalendarDto>
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Booking> _bookingRepository;

    public GetSlotCalendarQueryHandler(
        IRepository<Screen> screenRepository,
        IRepository<Booking> bookingRepository)
    {
        _screenRepository = screenRepository;
        _bookingRepository = bookingRepository;
    }

    public async Task<SlotCalendarDto> Handle(GetSlotCalendarQuery request, CancellationToken cancellationToken)
    {
        var screen = await _screenRepository.GetByIdAsync(request.ScreenId, cancellationToken);
        if (screen == null)
            throw new KeyNotFoundException($"Screen {request.ScreenId} not found");

        // Get all bookings for this screen in the date range
        var allBookings = (await _bookingRepository.GetAllAsync(cancellationToken))
            .Where(b => b.ScreenId == request.ScreenId && 
                       b.StartDate.Date <= request.EndDate.Date &&
                       b.EndDate.Date >= request.StartDate.Date &&
                       (b.Status == Domain.Enums.BookingStatus.Approved || 
                        b.Status == Domain.Enums.BookingStatus.Active ||
                        b.Status == Domain.Enums.BookingStatus.Completed))
            .ToList();

        var calendar = new SlotCalendarDto
        {
            ScreenId = screen.Id,
            ScreenName = screen.Name,
            SlotsPerFrame = screen.SlotsPerFrame,
            Days = new List<CalendarDayDto>()
        };

        // Generate calendar for each day in range
        var currentDate = request.StartDate.Date;
        while (currentDate <= request.EndDate.Date)
        {
            var dayOfWeek = currentDate.DayOfWeek;
            var daySchedule = GetDaySchedule(screen.Schedule, dayOfWeek);
            
            var dayDto = new CalendarDayDto
            {
                Date = currentDate,
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
                        // Check if booking contains this date
                        if (b.StartDate.Date > currentDate || b.EndDate.Date < currentDate)
                            return false;

                        // Check if booking includes this slot
                        if (b.DailySlotAssignments != null && b.DailySlotAssignments.TryGetValue(currentDate, out var slotForDay))
                        {
                            return slotForDay == slotNum;
                        }

                        // Fallback: check SlotNumbers
                        return b.SlotNumbers != null && b.SlotNumbers.Any(s => s == slotNum);
                    });

                    if (booking != null)
                    {
                        slotDto.Status = "booked";
                        slotDto.BookingId = booking.Id;
                        slotDto.CampaignName = booking.Campaign?.Name ?? "Unknown Campaign";
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
