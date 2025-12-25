using MediatR;

namespace CCMS.Application.Features.Streaming.Queries;

/// <summary>
/// Query to check if a user has permission to view a screen's live stream
/// </summary>
public class GetStreamAccessQuery : IRequest<bool>
{
    public string ScreenId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
}
