using MediatR;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Features.Screens.Queries;

public class GetSlotCalendarQuery : IRequest<SlotCalendarDto>
{
    public Guid ScreenId { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
}
