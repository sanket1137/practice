using MediatR;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Features.Screens.Queries;

public class GetScreensQuery : IRequest<IEnumerable<ScreenDto>>
{
    // We can add filters here later if needed
}
