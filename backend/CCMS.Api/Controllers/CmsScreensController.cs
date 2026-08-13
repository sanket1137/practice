using System.Security.Claims;
using Asp.Versioning;
using CCMS.Api.Services;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CCMS.Api.Controllers;

public class ScreenHealthDto
{
    public Guid ScreenId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = "offline";  // online | stale | offline
    public DateTime? LastSeenAt { get; set; }
    public string? CurrentPlaylistName { get; set; }
    public Guid? CurrentPlaylistId { get; set; }
    public string? LocationTag { get; set; }
    public bool AutoApprovalEnabled { get; set; }
}

[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/cms/screens")]
[Authorize]
public class CmsScreensController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ReportExportService _reportExportService;

    public CmsScreensController(ApplicationDbContext context, ReportExportService reportExportService)
    {
        _context = context;
        _reportExportService = reportExportService;
    }

    /// <summary>Returns health status for all screens owned by the current CMS user.</summary>
    [HttpGet("health")]
    public async Task<ActionResult<ApiResponse<List<ScreenHealthDto>>>> GetHealth(CancellationToken ct)
    {
        var userId = GetUserId();
        var now = DateTime.UtcNow;

        var screens = await _context.Screens
            .AsNoTracking()
            .Where(s => s.OwnerId == userId && !s.IsDeleted)
            .Select(s => new
            {
                s.Id,
                s.Name,
                s.LastSeenAt,
                s.LocationTag,
                s.AutoApprovalEnabled,
                s.DefaultPlaylistId,
                DefaultPlaylistName = s.DefaultPlaylist != null ? s.DefaultPlaylist.Name : null,
            })
            .ToListAsync(ct);

        var result = screens.Select(s =>
        {
            string status = "offline";
            if (s.LastSeenAt.HasValue)
            {
                var age = (now - s.LastSeenAt.Value).TotalMinutes;
                status = age < 3 ? "online" : age < 60 ? "stale" : "offline";
            }
            return new ScreenHealthDto
            {
                ScreenId = s.Id,
                Name = s.Name,
                Status = status,
                LastSeenAt = s.LastSeenAt,
                CurrentPlaylistName = s.DefaultPlaylistName,
                CurrentPlaylistId = s.DefaultPlaylistId,
                LocationTag = s.LocationTag,
                AutoApprovalEnabled = s.AutoApprovalEnabled,
            };
        }).ToList();

        return Ok(ApiResponse<List<ScreenHealthDto>>.SuccessResponse(result));
    }

    /// <summary>Downloads screen health data as a PDF report.</summary>
    [HttpGet("health-report")]
    public async Task<IActionResult> GetHealthReport(CancellationToken ct)
    {
        var userId = GetUserId();
        var now = DateTime.UtcNow;

        var screens = await _context.Screens
            .AsNoTracking()
            .Where(s => s.OwnerId == userId && !s.IsDeleted)
            .Select(s => new
            {
                s.Id,
                s.Name,
                s.LastSeenAt,
                s.LocationTag,
                DefaultPlaylistName = s.DefaultPlaylist != null ? s.DefaultPlaylist.Name : null,
            })
            .ToListAsync(ct);

        var rows = screens.Select(s =>
        {
            string status = "offline";
            if (s.LastSeenAt.HasValue)
            {
                var age = (now - s.LastSeenAt.Value).TotalMinutes;
                status = age < 3 ? "online" : age < 60 ? "stale" : "offline";
            }
            return new ReportExportService.ScreenHealthRow(
                Name: s.Name,
                LocationTag: s.LocationTag,
                Status: status,
                LastSeenAt: s.LastSeenAt.HasValue ? s.LastSeenAt.Value.ToString("yyyy-MM-dd HH:mm") + " UTC" : "—",
                CurrentPlaylist: s.DefaultPlaylistName ?? "—"
            );
        }).ToList();

        var pdfBytes = _reportExportService.ExportScreenHealthReportToPdf(rows);
        var fileName = $"screen-health-{now:yyyy-MM-dd}.pdf";
        return File(pdfBytes, "application/pdf", fileName);
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(claim, out var id))
            throw new UnauthorizedAccessException("Invalid user claim");
        return id;
    }
}