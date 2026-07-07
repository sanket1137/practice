using System.Security.Claims;
using Asp.Versioning;
using CCMS.Domain.Entities;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CCMS.Api.Controllers;

public class ScheduleWindowDto
{
    public Guid Id { get; set; }
    public Guid ScreenId { get; set; }
    public Guid PlaylistId { get; set; }
    public string? PlaylistName { get; set; }
    public int DaysOfWeekMask { get; set; }
    public int StartMinute { get; set; }
    public int EndMinute { get; set; }
    public bool IsActive { get; set; }
    public string? Label { get; set; }
}

public class CreateScheduleWindowRequest
{
    public Guid PlaylistId { get; set; }
    public int DaysOfWeekMask { get; set; }
    public int StartMinute { get; set; }
    public int EndMinute { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Label { get; set; }
}

public class UpdateScheduleWindowRequest
{
    public Guid? PlaylistId { get; set; }
    public int? DaysOfWeekMask { get; set; }
    public int? StartMinute { get; set; }
    public int? EndMinute { get; set; }
    public bool? IsActive { get; set; }
    public string? Label { get; set; }
}

[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/cms/screens/{screenId}/schedule/windows")]
[Authorize]
public class CmsScheduleController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public CmsScheduleController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ScheduleWindowDto>>>> List(
        Guid screenId, CancellationToken ct)
    {
        var userId = GetUserId();
        if (!await OwnsScreen(userId, screenId, ct))
            return Forbid();

        var windows = await _context.ScheduleWindows
            .AsNoTracking()
            .Where(w => w.ScreenId == screenId)
            .Select(w => new ScheduleWindowDto
            {
                Id = w.Id,
                ScreenId = w.ScreenId,
                PlaylistId = w.PlaylistId,
                PlaylistName = w.Playlist.Name,
                DaysOfWeekMask = w.DaysOfWeekMask,
                StartMinute = w.StartMinute,
                EndMinute = w.EndMinute,
                IsActive = w.IsActive,
                Label = w.Label,
            })
            .ToListAsync(ct);

        return Ok(ApiResponse<List<ScheduleWindowDto>>.SuccessResponse(windows));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<ScheduleWindowDto>>> Create(
        Guid screenId, [FromBody] CreateScheduleWindowRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        if (!await OwnsScreen(userId, screenId, ct))
            return Forbid();

        if (request.StartMinute >= request.EndMinute)
            return BadRequest(ApiResponse<ScheduleWindowDto>.ErrorResponse("StartMinute must be before EndMinute"));

        // Conflict detection
        var overlapping = await GetOverlapping(screenId, request.DaysOfWeekMask, request.StartMinute, request.EndMinute, null, ct);
        if (overlapping)
            return Conflict(ApiResponse<ScheduleWindowDto>.ErrorResponse("Time window overlaps with an existing window on one or more days"));

        var window = new ScheduleWindow
        {
            ScreenId = screenId,
            PlaylistId = request.PlaylistId,
            DaysOfWeekMask = request.DaysOfWeekMask,
            StartMinute = request.StartMinute,
            EndMinute = request.EndMinute,
            IsActive = request.IsActive,
            Label = request.Label,
        };

        _context.ScheduleWindows.Add(window);
        await _context.SaveChangesAsync(ct);

        var playlist = await _context.Playlists.AsNoTracking().FirstOrDefaultAsync(p => p.Id == request.PlaylistId, ct);
        var dto = new ScheduleWindowDto
        {
            Id = window.Id,
            ScreenId = window.ScreenId,
            PlaylistId = window.PlaylistId,
            PlaylistName = playlist?.Name,
            DaysOfWeekMask = window.DaysOfWeekMask,
            StartMinute = window.StartMinute,
            EndMinute = window.EndMinute,
            IsActive = window.IsActive,
            Label = window.Label,
        };

        return Created(string.Empty, ApiResponse<ScheduleWindowDto>.SuccessResponse(dto, "Window created"));
    }

    [HttpPut("{windowId}")]
    public async Task<ActionResult<ApiResponse<ScheduleWindowDto>>> Update(
        Guid screenId, Guid windowId, [FromBody] UpdateScheduleWindowRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        if (!await OwnsScreen(userId, screenId, ct))
            return Forbid();

        var window = await _context.ScheduleWindows
            .FirstOrDefaultAsync(w => w.Id == windowId && w.ScreenId == screenId, ct);

        if (window == null)
            return NotFound(ApiResponse<ScheduleWindowDto>.ErrorResponse("Window not found"));

        var newStart = request.StartMinute ?? window.StartMinute;
        var newEnd = request.EndMinute ?? window.EndMinute;
        var newMask = request.DaysOfWeekMask ?? window.DaysOfWeekMask;

        if (newStart >= newEnd)
            return BadRequest(ApiResponse<ScheduleWindowDto>.ErrorResponse("StartMinute must be before EndMinute"));

        var overlapping = await GetOverlapping(screenId, newMask, newStart, newEnd, windowId, ct);
        if (overlapping)
            return Conflict(ApiResponse<ScheduleWindowDto>.ErrorResponse("Time window overlaps with an existing window on one or more days"));

        if (request.PlaylistId.HasValue) window.PlaylistId = request.PlaylistId.Value;
        if (request.DaysOfWeekMask.HasValue) window.DaysOfWeekMask = request.DaysOfWeekMask.Value;
        if (request.StartMinute.HasValue) window.StartMinute = request.StartMinute.Value;
        if (request.EndMinute.HasValue) window.EndMinute = request.EndMinute.Value;
        if (request.IsActive.HasValue) window.IsActive = request.IsActive.Value;
        if (request.Label != null) window.Label = request.Label;
        window.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        var playlist = await _context.Playlists.AsNoTracking().FirstOrDefaultAsync(p => p.Id == window.PlaylistId, ct);
        var dto = new ScheduleWindowDto
        {
            Id = window.Id,
            ScreenId = window.ScreenId,
            PlaylistId = window.PlaylistId,
            PlaylistName = playlist?.Name,
            DaysOfWeekMask = window.DaysOfWeekMask,
            StartMinute = window.StartMinute,
            EndMinute = window.EndMinute,
            IsActive = window.IsActive,
            Label = window.Label,
        };

        return Ok(ApiResponse<ScheduleWindowDto>.SuccessResponse(dto, "Window updated"));
    }

    [HttpDelete("{windowId}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(
        Guid screenId, Guid windowId, CancellationToken ct)
    {
        var userId = GetUserId();
        if (!await OwnsScreen(userId, screenId, ct))
            return Forbid();

        var window = await _context.ScheduleWindows
            .FirstOrDefaultAsync(w => w.Id == windowId && w.ScreenId == screenId, ct);

        if (window == null)
            return NotFound(ApiResponse<bool>.ErrorResponse("Window not found"));

        window.IsDeleted = true;
        window.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        return Ok(ApiResponse<bool>.SuccessResponse(true, "Window deleted"));
    }

    private async Task<bool> GetOverlapping(Guid screenId, int mask, int start, int end, Guid? excludeId, CancellationToken ct)
    {
        var existing = await _context.ScheduleWindows
            .AsNoTracking()
            .Where(w => w.ScreenId == screenId && (excludeId == null || w.Id != excludeId))
            .ToListAsync(ct);

        return existing.Any(w =>
            (w.DaysOfWeekMask & mask) != 0 &&
            w.StartMinute < end &&
            w.EndMinute > start);
    }

    private async Task<bool> OwnsScreen(Guid userId, Guid screenId, CancellationToken ct)
    {
        return await _context.Screens
            .AsNoTracking()
            .AnyAsync(s => s.Id == screenId && s.OwnerId == userId && !s.IsDeleted, ct);
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(claim, out var id))
            throw new UnauthorizedAccessException("Invalid user claim");
        return id;
    }
}