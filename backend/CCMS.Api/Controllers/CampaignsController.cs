using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CCMS.Application.Features.Campaigns.Commands;
using CCMS.Application.Features.Campaigns.Queries;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Campaigns;

namespace CCMS.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CampaignsController : ControllerBase
{
    private readonly IMediator _mediator;

    public CampaignsController(IMediator mediator) => _mediator = mediator;

    // GET /api/campaigns
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IEnumerable<CampaignDto>>>> GetAll()
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var query = new GetCampaignsQuery { UserId = User.IsInRole("Admin") ? Guid.Empty : userId };
            var result = await _mediator.Send(query);
            return Ok(ApiResponse<IEnumerable<CampaignDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            return StatusCode(500,
                ApiResponse<IEnumerable<CampaignDto>>.ErrorResponse($"Error retrieving campaigns: {ex.Message}"));
        }
    }

    // POST /api/campaigns
    [HttpPost]
    [Authorize(Roles = "Advertiser,ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<CampaignDto>>> Create([FromBody] CreateCampaignRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var command = new CreateCampaignCommand { UserId = userId, Request = request };
            var result = await _mediator.Send(command);
            return CreatedAtAction(nameof(GetById), new { id = result.Id },
                ApiResponse<CampaignDto>.SuccessResponse(result, "Campaign created successfully"));
        }
        catch (Exception ex)
        {
            return StatusCode(500,
                ApiResponse<CampaignDto>.ErrorResponse($"Error creating campaign: {ex.Message}"));
        }
    }

    // GET /api/campaigns/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<CampaignDto>>> GetById(Guid id)
    {
        try
        {
            var query = new GetCampaignByIdQuery { CampaignId = id };
            var result = await _mediator.Send(query);
            
            if (result == null)
                return NotFound(ApiResponse<CampaignDto>.ErrorResponse("Campaign not found"));
            
            return Ok(ApiResponse<CampaignDto>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            return StatusCode(500,
                ApiResponse<CampaignDto>.ErrorResponse($"Error retrieving campaign: {ex.Message}"));
        }
    }

    // PUT /api/campaigns/{id}
    [HttpPut("{id}")]
    [Authorize(Roles = "Advertiser,ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<CampaignDto>>> Update(Guid id, [FromBody] UpdateCampaignRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var isAdmin = User.IsInRole("Admin");
            var command = new UpdateCampaignCommand 
            { 
                CampaignId = id, 
                UserId = userId, 
                IsAdmin = isAdmin,
                Request = request 
            };
            var result = await _mediator.Send(command);
            return Ok(ApiResponse<CampaignDto>.SuccessResponse(result, "Campaign updated successfully"));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse<CampaignDto>.ErrorResponse("Campaign not found"));
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (Exception ex)
        {
            return StatusCode(500,
                ApiResponse<CampaignDto>.ErrorResponse($"Error updating campaign: {ex.Message}"));
        }
    }

    // DELETE /api/campaigns/{id}
    [HttpDelete("{id}")]
    [Authorize(Roles = "Advertiser,ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var isAdmin = User.IsInRole("Admin");
            var command = new DeleteCampaignCommand 
            { 
                CampaignId = id, 
                UserId = userId,
                IsAdmin = isAdmin
            };
            await _mediator.Send(command);
            return Ok(ApiResponse<object>.SuccessResponse(null, "Campaign deleted successfully"));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse<object>.ErrorResponse("Campaign not found"));
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (Exception ex)
        {
            return StatusCode(500,
                ApiResponse<object>.ErrorResponse($"Error deleting campaign: {ex.Message}"));
        }
    }
}
