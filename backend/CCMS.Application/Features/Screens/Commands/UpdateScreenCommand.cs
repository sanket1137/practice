using MediatR;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Features.Screens.Commands;

public class UpdateScreenCommand : IRequest<ScreenDto>
{
    public Guid ScreenId { get; set; }
    public Guid UserId { get; set; }
    public UpdateScreenRequest Request { get; set; } = null!;
}
