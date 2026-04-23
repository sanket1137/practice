using MediatR;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Features.Screens.Queries;

public class GetScreensQuery : IRequest<IEnumerable<ScreenDto>>
{
    public Guid? OwnerId { get; set; } // Filter screens by owner
    public string? CallerRole { get; set; } // For visibility filtering
}
