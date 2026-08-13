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

/// <summary>Playlist CRUD for CMS-mode screens.</summary>
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/cms/playlists")]
[Authorize]
public class CmsPlaylistsController : ControllerBase
{
    private readonly ICmsPlaylistService _service;
    private readonly IHubContext<CmsControlHub> _hub;

    public CmsPlaylistsController(ICmsPlaylistService service, IHubContext<CmsControlHub> hub)
    {
        _service = service;
        _hub = hub;
    }

    [HttpGet("by-screen/{screenId}")]
    public async Task<ActionResult<ApiResponse<List<CmsPlaylistDto>>>> ListForScreen(Guid screenId, CancellationToken ct)
    {
        try
        {
            var result = await _service.ListForScreenAsync(GetUserId(), screenId, ct);
            return Ok(ApiResponse<List<CmsPlaylistDto>>.SuccessResponse(result));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<List<CmsPlaylistDto>>.ErrorResponse(ex.Message));
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<CmsPlaylistDto>>> Get(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _service.GetAsync(GetUserId(), id, ct);
            return Ok(ApiResponse<CmsPlaylistDto>.SuccessResponse(result));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<CmsPlaylistDto>.ErrorResponse(ex.Message));
        }
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<CmsPlaylistDto>>> Create(
        [FromBody] CreateCmsPlaylistRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _service.CreateAsync(GetUserId(), request, ct);
            return StatusCode(StatusCodes.Status201Created, ApiResponse<CmsPlaylistDto>.SuccessResponse(result, "Playlist created"));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<CmsPlaylistDto>.ErrorResponse(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<CmsPlaylistDto>.ErrorResponse(ex.Message));
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<CmsPlaylistDto>>> Update(
        Guid id, [FromBody] UpdateCmsPlaylistRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _service.UpdateAsync(GetUserId(), id, request, ct);
            return Ok(ApiResponse<CmsPlaylistDto>.SuccessResponse(result));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<CmsPlaylistDto>.ErrorResponse(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<CmsPlaylistDto>.ErrorResponse(ex.Message));
        }
    }

    [HttpPut("{id}/items")]
    public async Task<ActionResult<ApiResponse<CmsPlaylistDto>>> ReplaceItems(
        Guid id, [FromBody] ReplacePlaylistItemsRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _service.ReplaceItemsAsync(GetUserId(), id, request, ct);
            await _hub.Clients.Group(CmsControlHub.GroupName(result.ScreenId))
                .SendAsync("playlist_updated", new { screenId = result.ScreenId, playlistId = result.Id, version = result.Version }, ct);
            return Ok(ApiResponse<CmsPlaylistDto>.SuccessResponse(result, "Playlist published"));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<CmsPlaylistDto>.ErrorResponse(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<CmsPlaylistDto>.ErrorResponse(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<CmsPlaylistDto>.ErrorResponse(ex.Message));
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id, CancellationToken ct)
    {
        try
        {
            await _service.DeleteAsync(GetUserId(), id, ct);
            return Ok(ApiResponse<bool>.SuccessResponse(true, "Deleted"));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<bool>.ErrorResponse(ex.Message));
        }
    }

    [HttpPost("{id}/set-default")]
    public async Task<ActionResult<ApiResponse<bool>>> SetDefault(
        Guid id, [FromQuery] Guid screenId, CancellationToken ct)
    {
        try
        {await _hub.Clients.Group(CmsControlHub.GroupName(screenId))
                .SendAsync("playlist_updated", new { screenId, playlistId = id, defaultChanged = true }, ct);
            
            await _service.SetDefaultAsync(GetUserId(), screenId, id, ct);
            return Ok(ApiResponse<bool>.SuccessResponse(true, "Default playlist set"));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<bool>.ErrorResponse(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<bool>.ErrorResponse(ex.Message));
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
