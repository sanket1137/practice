using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using Asp.Versioning;

namespace CCMS.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/festivals")]
[Authorize]
public class FestivalsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<FestivalsController> _logger;

    public FestivalsController(ApplicationDbContext context, ILogger<FestivalsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>Get festival entries for a year</summary>
    // Public: festival calendar data feeds marketplace pricing suggestions shown to
    // unauthenticated visitors browsing screens, so it must stay reachable without auth.
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetFestivals([FromQuery] int year = 0)
    {
        if (year == 0) year = DateTime.UtcNow.Year;
        try
        {
            var festivals = await _context.FestivalEntries.AsNoTracking()
                .Where(f => f.Year == year && f.IsActive)
                .OrderBy(f => f.StartDate)
                .Select(f => new
                {
                    f.Id,
                    f.Name,
                    f.StartDate,
                    f.EndDate,
                    f.Year,
                    f.Region,
                    f.SuggestedMultiplier
                })
                .ToListAsync();

            return Ok(ApiResponse<object>.SuccessResponse(festivals));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching festivals");
            return StatusCode(500, new { error = "Error fetching festivals" });
        }
    }
}
