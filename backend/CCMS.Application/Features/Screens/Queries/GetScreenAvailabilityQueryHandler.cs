using MediatR;
using CCMS.Application.Services;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Features.Screens.Queries;

public class GetScreenAvailabilityQueryHandler : IRequestHandler<GetScreenAvailabilityQuery, ScreenAvailabilityDto>
{
    private readonly SlotAvailabilityService _slotAvailabilityService;

    public GetScreenAvailabilityQueryHandler(SlotAvailabilityService slotAvailabilityService)
    {
        _slotAvailabilityService = slotAvailabilityService;
    }

    public async Task<ScreenAvailabilityDto> Handle(GetScreenAvailabilityQuery request, CancellationToken cancellationToken)
    {
        var dailyAvailability = await _slotAvailabilityService.GetAvailability(
            request.ScreenId,
            request.StartDate,
            request.EndDate,
            cancellationToken);

        var result = new ScreenAvailabilityDto
        {
            Availability = dailyAvailability.Select(da => new DailyAvailabilityDto
            {
                Date = da.Date,
                DayOfWeek = da.DayOfWeek,
                TotalSlots = da.TotalSlots,
                AvailableSlots = da.AvailableSlots,
                AvailableSlotNumbers = da.AvailableSlotNumbers,
                Status = da.Status
            }).ToList(),
            Summary = new AvailabilitySummaryDto
            {
                TotalDays = dailyAvailability.Count,
                AvailableDays = dailyAvailability.Count(da => da.Status != "SOLD_OUT"),
                SoldOutDays = dailyAvailability.Count(da => da.Status == "SOLD_OUT"),
                TotalAvailableSlots = dailyAvailability.Sum(da => da.AvailableSlots)
            }
        };

        return result;
    }
}
