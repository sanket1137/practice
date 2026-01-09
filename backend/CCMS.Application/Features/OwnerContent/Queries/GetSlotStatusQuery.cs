using CCMS.Shared.DTOs.OwnerContent;
using MediatR;

namespace CCMS.Application.Features.OwnerContent.Queries;

public class GetSlotStatusQuery : IRequest<List<SlotStatusDto>>
{
    public Guid ScreenId { get; set; }
}
