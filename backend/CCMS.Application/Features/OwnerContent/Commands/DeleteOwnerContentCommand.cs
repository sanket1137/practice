using CCMS.Shared.DTOs.OwnerContent;
using MediatR;

namespace CCMS.Application.Features.OwnerContent.Commands;

public class DeleteOwnerContentCommand : IRequest<bool>
{
    public Guid ScreenId { get; set; }
    public Guid OwnerId { get; set; }
    public int SlotNumber { get; set; }
}
