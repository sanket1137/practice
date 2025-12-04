using MediatR;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Features.Screens.Commands;

public class CreateScreenCommand : IRequest<ScreenDto>
{
    public Guid UserId { get; set; }
    public CreateScreenRequest Request { get; set; } = null!;
}
