using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using CCMS.Application.Features.Screens.Commands;
using CCMS.Application.Features.Screens.Queries;
using CCMS.Api.Extensions;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Screens;
using Asp.Versioning;

namespace CCMS.Api.Controllers;

[Authorize(Roles = "ScreenOwner,Admin")]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/screens/{screenId}/pricing-rules")]
[EnableRateLimiting(RateLimitingExtensions.ApiPolicy)]
public class PricingRulesController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<PricingRulesController> _logger;

    public PricingRulesController(IMediator mediator, ApplicationDbContext context, ILogger<PricingRulesController> logger)
    {
        _mediator = mediator;
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<IEnumerable<PricingRuleDto>>>> GetAll(
        Guid screenId,
        [FromQuery] bool activeOnly = false)
    {
        try
        {
            var query = new GetPricingRulesQuery { ScreenId = screenId, ActiveOnly = activeOnly };
            var result = await _mediator.Send(query);
            return Ok(ApiResponse<IEnumerable<PricingRuleDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving pricing rules for screen {ScreenId}", screenId);
            return StatusCode(500, ApiResponse<IEnumerable<PricingRuleDto>>.ErrorResponse("Failed to retrieve pricing rules."));
        }
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<PricingRuleDto>>> Create(
        Guid screenId,
        [FromBody] CreatePricingRuleRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var command = new CreatePricingRuleCommand { ScreenId = screenId, UserId = userId, Request = request };
            var result = await _mediator.Send(command);
            return CreatedAtAction(nameof(GetAll), new { screenId }, ApiResponse<PricingRuleDto>.SuccessResponse(result, "Pricing rule created"));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, ApiResponse<PricingRuleDto>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating pricing rule for screen {ScreenId}", screenId);
            return StatusCode(500, ApiResponse<PricingRuleDto>.ErrorResponse("Failed to create pricing rule."));
        }
    }

    [HttpPut("{ruleId}")]
    public async Task<ActionResult<ApiResponse<PricingRuleDto>>> Update(
        Guid screenId,
        Guid ruleId,
        [FromBody] UpdatePricingRuleRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var command = new UpdatePricingRuleCommand { RuleId = ruleId, UserId = userId, Request = request };
            var result = await _mediator.Send(command);
            return Ok(ApiResponse<PricingRuleDto>.SuccessResponse(result, "Pricing rule updated"));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<PricingRuleDto>.ErrorResponse(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, ApiResponse<PricingRuleDto>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating pricing rule {RuleId} for screen {ScreenId}", ruleId, screenId);
            return StatusCode(500, ApiResponse<PricingRuleDto>.ErrorResponse("Failed to update pricing rule."));
        }
    }

    [HttpDelete("{ruleId}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid screenId, Guid ruleId)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var command = new DeletePricingRuleCommand { RuleId = ruleId, UserId = userId };
            await _mediator.Send(command);
            return Ok(ApiResponse<object>.SuccessResponse(null, "Pricing rule deleted"));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.ErrorResponse(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, ApiResponse<object>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting pricing rule {RuleId} for screen {ScreenId}", ruleId, screenId);
            return StatusCode(500, ApiResponse<object>.ErrorResponse("Failed to delete pricing rule."));
        }
    }

    [HttpPost("{ruleId}/toggle")]
    public async Task<ActionResult<ApiResponse<PricingRuleDto>>> Toggle(Guid screenId, Guid ruleId)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var command = new TogglePricingRuleCommand { RuleId = ruleId, UserId = userId };
            var result = await _mediator.Send(command);
            return Ok(ApiResponse<PricingRuleDto>.SuccessResponse(result, "Pricing rule toggled"));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<PricingRuleDto>.ErrorResponse(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, ApiResponse<PricingRuleDto>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error toggling pricing rule {RuleId} for screen {ScreenId}", ruleId, screenId);
            return StatusCode(500, ApiResponse<PricingRuleDto>.ErrorResponse("Failed to toggle pricing rule."));
        }
    }

    /// <summary>Bulk create festive/seasonal pricing rules</summary>
    [HttpPost("bulk")]
    public async Task<IActionResult> BulkCreate(Guid screenId, [FromBody] BulkPricingRulesRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var screen = await _context.Screens.FirstOrDefaultAsync(s => s.Id == screenId && s.OwnerId == userId);
            if (screen == null) return NotFound(new { error = "Screen not found or access denied" });

            var rules = request.Rules.Select(r => new PricingRule
            {
                ScreenId = screenId,
                Name = r.Name,
                RuleType = PricingRuleType.DateRange,
                StartDate = DateOnly.Parse(r.StartDate),
                EndDate = DateOnly.Parse(r.EndDate),
                RegularSlotPrice = Math.Round(screen.PricePerSlot * r.Multiplier, 2),
                IsActive = true
            }).ToList();

            _context.PricingRules.AddRange(rules);
            await _context.SaveChangesAsync();

            return Ok(new { created = rules.Count, message = $"{rules.Count} pricing rules created" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error bulk creating pricing rules for screen {ScreenId}", screenId);
            return StatusCode(500, new { error = "Failed to create pricing rules." });
        }
    }
}

public class BulkPricingRulesRequest
{
    public List<BulkPricingRuleItem> Rules { get; set; } = new();
}

public class BulkPricingRuleItem
{
    public string Name { get; set; } = string.Empty;
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public decimal Multiplier { get; set; } = 1.5m;
}
