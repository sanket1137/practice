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
            var query = new GetScreensQuery();
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

    // Additional endpoints would go here (Update, Delete, List, etc.)
}
