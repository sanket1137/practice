using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CCMS.Application.Features.Screens.Commands;
using CCMS.Application.Features.Screens.Queries;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ScreensController : ControllerBase
{
    private readonly IMediator _mediator;

    public ScreensController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<IEnumerable<ScreenDto>>>> GetAll()
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(ApiResponse<IEnumerable<ScreenDto>>.ErrorResponse("User not authenticated"));

            var userGuid = Guid.Parse(userId);
            var isScreenOwner = User.IsInRole("ScreenOwner");
            
            var query = new GetScreensQuery();
            
            // Screen owners see ONLY their own screens
            // Advertisers and Admins see ALL screens (for browsing/booking)
            if (isScreenOwner)
            {
                query.OwnerId = userGuid;
            }
            
            var result = await _mediator.Send(query);
            return Ok(ApiResponse<IEnumerable<ScreenDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<IEnumerable<ScreenDto>>.ErrorResponse($"Error retrieving screens: {ex.Message}"));
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<ScreenDto>>> GetById(Guid id)
    {
        try
        {
            var query = new GetScreenByIdQuery { ScreenId = id };
            var result = await _mediator.Send(query);

            if (result == null)
            {
                return NotFound(ApiResponse<ScreenDto>.ErrorResponse("Screen not found"));
            }

            return Ok(ApiResponse<ScreenDto>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<ScreenDto>.ErrorResponse($"Error retrieving screen: {ex.Message}"));
        }
    }

    [HttpPost]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<ScreenDto>>> Create([FromBody] CreateScreenRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var command = new CreateScreenCommand
            {
                UserId = userId,
                Request = request
            };

            var result = await _mediator.Send(command);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, 
                ApiResponse<ScreenDto>.SuccessResponse(result, "Screen created successfully"));
        }
        catch (Exception ex)
        {
            var errorMessage = $"Error creating screen: {ex.Message}";
            if (ex.InnerException != null)
            {
                errorMessage += $" Inner: {ex.InnerException.Message}";
            }
            return StatusCode(500, ApiResponse<ScreenDto>.ErrorResponse(errorMessage));
        }
    }

    [HttpGet("{id}/availability")]
    public async Task<ActionResult<ApiResponse<ScreenAvailabilityDto>>> GetAvailability(
        Guid id,
        [FromQuery] DateTime startDate,
        [FromQuery] DateTime endDate)
    {
        try
        {
            var query = new GetScreenAvailabilityQuery
            {
                ScreenId = id,
                StartDate = startDate,
                EndDate = endDate
            };

            var result = await _mediator.Send(query);
            return Ok(ApiResponse<ScreenAvailabilityDto>.SuccessResponse(result));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<ScreenAvailabilityDto>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<ScreenAvailabilityDto>.ErrorResponse($"Error checking availability: {ex.Message}"));
        }
    }

    [HttpGet("{id}/calendar")]
    public async Task<ActionResult<ApiResponse<SlotCalendarDto>>> GetSlotCalendar(
        Guid id,
        [FromQuery] DateTime startDate,
        [FromQuery] DateTime endDate)
    {
        try
        {
            var query = new GetSlotCalendarQuery
            {
                ScreenId = id,
                StartDate = startDate.Date,
                EndDate = endDate.Date
            };

            var result = await _mediator.Send(query);
            return Ok(ApiResponse<SlotCalendarDto>.SuccessResponse(result));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<SlotCalendarDto>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<SlotCalendarDto>.ErrorResponse($"Error retrieving calendar: {ex.Message}"));
        }
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<ScreenDto>>> Update(Guid id, [FromBody] UpdateScreenRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var command = new UpdateScreenCommand
            {
                ScreenId = id,
                UserId = userId,
                Request = request
            };

            var result = await _mediator.Send(command);
            return Ok(ApiResponse<ScreenDto>.SuccessResponse(result, "Screen updated successfully"));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, ApiResponse<ScreenDto>.ErrorResponse(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse<ScreenDto>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<ScreenDto>.ErrorResponse($"Error updating screen: {ex.Message}"));
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var command = new DeleteScreenCommand
            {
                ScreenId = id,
                UserId = userId
            };

            var result = await _mediator.Send(command);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, ApiResponse<object>.ErrorResponse(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse<object>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<object>.ErrorResponse($"Error deleting screen: {ex.Message}"));
        }
    }
}
