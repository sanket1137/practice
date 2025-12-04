using MediatR;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Features.Screens.Queries;

public class GetScreenByIdQuery : IRequest<ScreenDto?>
{
    public Guid ScreenId { get; set; }
}
