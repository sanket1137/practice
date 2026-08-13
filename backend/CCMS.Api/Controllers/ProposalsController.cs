using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using Asp.Versioning;

namespace CCMS.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/proposals")]
[Authorize(Roles = "Advertiser,Admin")]
public class ProposalsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ProposalsController> _logger;

    public ProposalsController(ApplicationDbContext context, ILogger<ProposalsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private Guid GetCurrentUserId() =>
        Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value!);

    /// <summary>Get active smart proposals for the current advertiser</summary>
    [HttpGet]
    public async Task<IActionResult> GetProposals([FromQuery] string status = "active")
    {
        try
        {
            var userId = GetCurrentUserId();

            var proposals = await _context.Notifications.AsNoTracking()
                .Where(n => n.UserId == userId
                    && n.ReferenceType == "SmartProposal"
                    && !n.IsRead)
                .OrderByDescending(n => n.CreatedAt)
                .Take(10)
                .Select(n => new
                {
                    n.Id,
                    n.Title,
                    n.Message,
                    n.ReferenceId,
                    n.ActionUrl,
                    n.CreatedAt,
                    ScreenId = n.ReferenceId
                })
                .ToListAsync();

            // Enrich with screen details
            var screenIds = proposals.Where(p => p.ScreenId.HasValue).Select(p => p.ScreenId!.Value).ToList();
            var screens = await _context.Screens.AsNoTracking()
                .Where(s => screenIds.Contains(s.Id))
                .Select(s => new
                {
                    s.Id,
                    s.Name,
                    s.PricePerSlot,
                    s.AudienceQualityScore,
                    Location = s.Location,
                    PrimaryImageUrl = s.Images.Where(i => i.IsPrimary).Select(i => i.ImageUrl).FirstOrDefault()
                })
                .ToListAsync();

            var enriched = proposals.Select(p => new
            {
                p.Id,
                p.Title,
                p.Message,
                p.CreatedAt,
                Screen = screens.FirstOrDefault(s => s.Id == p.ScreenId)
            });

            return Ok(ApiResponse<object>.SuccessResponse(enriched));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching proposals");
            return StatusCode(500, new { error = "Error fetching proposals" });
        }
    }

    /// <summary>Dismiss a proposal (marks it read + anti-fatigue reset)</summary>
    [HttpPut("{id}/dismiss")]
    public async Task<IActionResult> Dismiss(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            var notification = await _context.Notifications
                .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId && n.ReferenceType == "SmartProposal");
            if (notification == null) return NotFound(new { error = "Proposal not found" });

            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Proposal dismissed" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error dismissing proposal");
            return StatusCode(500, new { error = "Error dismissing proposal" });
        }
    }

    /// <summary>Accept a proposal — returns the screen ID to pre-fill wizard</summary>
    [HttpPut("{id}/accept")]
    public async Task<IActionResult> Accept(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            var notification = await _context.Notifications
                .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId && n.ReferenceType == "SmartProposal");
            if (notification == null) return NotFound(new { error = "Proposal not found" });

            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { screenId = notification.ReferenceId, message = "Proposal accepted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error accepting proposal");
            return StatusCode(500, new { error = "Error accepting proposal" });
        }
    }
}
