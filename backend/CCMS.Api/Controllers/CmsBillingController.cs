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
[Route("api/v{version:apiVersion}/cms/billing")]
[Authorize]
public class CmsBillingController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<CmsBillingController> _logger;

    public CmsBillingController(ApplicationDbContext context, ILogger<CmsBillingController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private Guid GetCurrentUserId() =>
        Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value!);

    private static readonly Dictionary<CmsPlanTier, int> PlanScreenLimits = new()
    {
        { CmsPlanTier.Free, 1 },
        { CmsPlanTier.Starter, 5 },
        { CmsPlanTier.Professional, 20 },
        { CmsPlanTier.Enterprise, int.MaxValue }
    };

    private static readonly Dictionary<CmsPlanTier, decimal> PlanMonthlyPrices = new()
    {
        { CmsPlanTier.Free, 0m },
        { CmsPlanTier.Starter, 999m },
        { CmsPlanTier.Professional, 2499m },
        { CmsPlanTier.Enterprise, 7499m }
    };

    /// <summary>Get current plan info</summary>
    [HttpGet("plan")]
    public async Task<IActionResult> GetPlan()
    {
        try
        {
            var userId = GetCurrentUserId();
            var user = await _context.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => new { u.CmsPlan, u.CmsPlanExpiresAt })
                .FirstOrDefaultAsync();

            if (user == null) return NotFound(new { error = "User not found" });

            var screensUsed = await _context.Screens.AsNoTracking()
                .CountAsync(s => s.OwnerId == userId && !s.IsDeleted);

            var limit = PlanScreenLimits.GetValueOrDefault(user.CmsPlan, 1);

            return Ok(ApiResponse<object>.SuccessResponse(new
            {
                currentPlan = user.CmsPlan.ToString(),
                nextRenewal = user.CmsPlanExpiresAt,
                screensUsed,
                screensLimit = limit == int.MaxValue ? -1 : limit,
                monthlyPrice = PlanMonthlyPrices.GetValueOrDefault(user.CmsPlan, 0m),
                features = GetPlanFeatures(user.CmsPlan)
            }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching billing plan");
            return StatusCode(500, new { error = "Error fetching plan" });
        }
    }

    /// <summary>Initiate plan upgrade via Razorpay Subscription</summary>
    [HttpPost("upgrade")]
    public async Task<IActionResult> UpgradePlan([FromBody] UpgradePlanRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!Enum.TryParse<CmsPlanTier>(request.TargetPlan, true, out var targetPlan))
                return BadRequest(new { error = "Invalid plan tier" });

            if (targetPlan == CmsPlanTier.Free)
                return BadRequest(new { error = "Cannot downgrade to Free via upgrade endpoint" });

            var amount = PlanMonthlyPrices.GetValueOrDefault(targetPlan, 0m);

            // In production: create Razorpay subscription here.
            // For now return a redirect URL with amount info.
            return Ok(new
            {
                targetPlan = targetPlan.ToString(),
                amount,
                currency = "INR",
                message = "Contact support for Enterprise plan",
                redirectUrl = $"/cms/billing?upgrade={targetPlan.ToString().ToLower()}&amount={amount}"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initiating plan upgrade");
            return StatusCode(500, new { error = "Error initiating upgrade" });
        }
    }

    private static object GetPlanFeatures(CmsPlanTier plan) => plan switch
    {
        CmsPlanTier.Free => new { screens = 1, remoteControl = "Basic", dayParting = false, analytics = "Basic" },
        CmsPlanTier.Starter => new { screens = 5, remoteControl = "Basic + Brightness/Volume", dayParting = false, analytics = "Standard" },
        CmsPlanTier.Professional => new { screens = 20, remoteControl = "Full", dayParting = true, analytics = "Full + Export" },
        CmsPlanTier.Enterprise => new { screens = "Unlimited", remoteControl = "Full + Bulk", dayParting = true, analytics = "Full + PDF + API" },
        _ => new { }
    };
}

public class UpgradePlanRequest
{
    public string TargetPlan { get; set; } = string.Empty;
}
