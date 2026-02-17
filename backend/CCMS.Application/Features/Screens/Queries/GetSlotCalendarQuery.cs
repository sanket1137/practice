using MediatR;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Features.Screens.Queries;

public class GetSlotCalendarQuery : IRequest<SlotCalendarDto>
{
    public Guid ScreenId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
}
