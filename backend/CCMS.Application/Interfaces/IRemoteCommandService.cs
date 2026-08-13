using CCMS.Shared.DTOs.Cms;

namespace CCMS.Application.Interfaces;

/// <summary>
/// Issues remote commands from the CMS dashboard to screens and records the
/// full audit trail. Also used by the CmsControlHub for ACK updates.
/// </summary>
public interface IRemoteCommandService
{
    Task<RemoteCommandDto> IssueAsync(Guid userId, IssueRemoteCommandRequest request, CancellationToken ct = default);

    Task<List<RemoteCommandDto>> GetRecentAsync(Guid userId, Guid screenId, int limit = 50, CancellationToken ct = default);

    Task AckAsync(Guid screenId, AckCommandRequest request, CancellationToken ct = default);
}
