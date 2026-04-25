using System.Security.Claims;
using Asp.Versioning;
using CCMS.Api.Hubs;
using CCMS.Application.Interfaces;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Cms;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace CCMS.Api.Controllers;

/// <summary>Issues and inspects remote commands for CMS-mode screens.</summary>
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/cms/commands")]
[Authorize]
public class CmsCommandsController : ControllerBase
{
    private readonly IRemoteCommandService _commandService;
    private readonly IHubContext<CmsControlHub> _hub;

    public CmsCommandsController(IRemoteCommandService commandService, IHubContext<CmsControlHub> hub)
    {
        _commandService = commandService;
        _hub = hub;
    }

    /// <summary>
    /// Dashboard issues a command. The service persists an audit row (Pending),
    /// then we push the command to the screen's SignalR group so a connected
    /// player can execute it. Status flips to Acked/Failed via the ACK endpoint.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<RemoteCommandDto>>> Issue(
        [FromBody] IssueRemoteCommandRequest request, CancellationToken ct)
    {
        try
        {
            var userId = GetUserId();
            var result = await _commandService.IssueAsync(userId, request, ct);

            await _hub.Clients.Group(CmsControlHub.GroupName(request.ScreenId))
                .SendAsync("command", result, ct);

            return Ok(ApiResponse<RemoteCommandDto>.SuccessResponse(result, "Command issued"));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<RemoteCommandDto>.ErrorResponse(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<RemoteCommandDto>.ErrorResponse(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<RemoteCommandDto>.ErrorResponse(ex.Message));
        }
    }

    [HttpGet("by-screen/{screenId}")]
    public async Task<ActionResult<ApiResponse<List<RemoteCommandDto>>>> Recent(
        Guid screenId, [FromQuery] int limit = 50, CancellationToken ct = default)
    {
        try
        {
            var result = await _commandService.GetRecentAsync(GetUserId(), screenId, limit, ct);
            return Ok(ApiResponse<List<RemoteCommandDto>>.SuccessResponse(result));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<List<RemoteCommandDto>>.ErrorResponse(ex.Message));
        }
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(claim, out var id))
        {
            throw new UnauthorizedAccessException("Invalid user claim");
        }
        return id;
    }
}
