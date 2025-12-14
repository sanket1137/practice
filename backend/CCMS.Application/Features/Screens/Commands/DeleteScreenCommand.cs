using MediatR;
using CCMS.Shared.Common;

namespace CCMS.Application.Features.Screens.Commands;

public class DeleteScreenCommand : IRequest<ApiResponse<object>>
{
    public Guid ScreenId { get; set; }
    public Guid UserId { get; set; }
}
