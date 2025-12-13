using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CCMS.Application.Features.Creatives.Commands;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Creatives;

namespace CCMS.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CreativesController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IRepository<Creative> _creativeRepository;

    public CreativesController(IMediator mediator, IRepository<Creative> creativeRepository)
    {
        _mediator = mediator;
        _creativeRepository = creativeRepository;
    }

    // POST /api/creatives/upload
    [HttpPost("upload")]
    [Authorize(Roles = "Advertiser,ScreenOwner,Admin")]
    [RequestSizeLimit(100_000_000)] // 100MB limit
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ApiResponse<CreativeDto>), 201)]
    [ProducesResponseType(400)]
    [ProducesResponseType(500)]
    [ApiExplorerSettings(IgnoreApi = true)] // Hide from Swagger due to IFormFile limitation
    public async Task<ActionResult<ApiResponse<CreativeDto>>> Upload(
        [FromForm] IFormFile file, 
        [FromForm] Guid campaignId, 
        [FromForm] string name, 
        [FromForm] int duration = 10,
        [FromForm] int width = 1920,
        [FromForm] int height = 1080)
    {
        try
        {
            if (file == null || file.Length == 0)
                return BadRequest(ApiResponse<CreativeDto>.ErrorResponse("No file uploaded"));

            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            
            var command = new UploadCreativeCommand
            {
                CampaignId = campaignId,
                UserId = userId,
                FileStream = file.OpenReadStream(),
                FileName = file.FileName,
                ContentType = file.ContentType,
                FileSize = file.Length,
                Name = name,
                Duration = duration,
                Width = width,
                Height = height
            };

            var result = await _mediator.Send(command);
            return CreatedAtAction(nameof(GetById), new { id = result.Id },
                ApiResponse<CreativeDto>.SuccessResponse(result, "Creative uploaded successfully"));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<CreativeDto>.ErrorResponse(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid();
        }
        catch (Exception ex)
        {
            return StatusCode(500,
                ApiResponse<CreativeDto>.ErrorResponse($"Error uploading creative: {ex.Message}"));
        }
    }

    // GET /api/creatives/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<CreativeDto>>> GetById(Guid id)
    {
        try
        {
            var creative = await _creativeRepository.GetByIdAsync(id);
            if (creative == null)
                return NotFound(ApiResponse<CreativeDto>.ErrorResponse("Creative not found"));

            var dto = new CreativeDto
            {
                Id = creative.Id,
                CampaignId = creative.CampaignId,
                Name = creative.Name,
                FileUrl = creative.FileUrl,
                FileName = creative.FileName,
                MimeType = creative.MimeType,
                FileSize = creative.FileSize,
                Width = creative.Width,
                Height = creative.Height,
                Duration = creative.Duration,
                ThumbnailUrl = creative.ThumbnailUrl,
                CreatedAt = creative.CreatedAt
            };

            return Ok(ApiResponse<CreativeDto>.SuccessResponse(dto));
        }
        catch (Exception ex)
        {
            return StatusCode(500,
                ApiResponse<CreativeDto>.ErrorResponse($"Error retrieving creative: {ex.Message}"));
        }
    }

    // GET /api/campaigns/{campaignId}/creatives
    [HttpGet("/api/campaigns/{campaignId}/creatives")]
    public async Task<ActionResult<ApiResponse<IEnumerable<CreativeDto>>>> GetByCampaign(Guid campaignId)
    {
        try
        {
            var creatives = await _creativeRepository.FindAsync(c => c.CampaignId == campaignId);
            var result = creatives.Select(c => new CreativeDto
            {
                Id = c.Id,
                CampaignId = c.CampaignId,
                Name = c.Name,
                FileUrl = c.FileUrl,
                FileName = c.FileName,
                MimeType = c.MimeType,
                FileSize = c.FileSize,
                Width = c.Width,
                Height = c.Height,
                Duration = c.Duration,
                ThumbnailUrl = c.ThumbnailUrl,
                CreatedAt = c.CreatedAt
            });

            return Ok(ApiResponse<IEnumerable<CreativeDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            return StatusCode(500,
                ApiResponse<IEnumerable<CreativeDto>>.ErrorResponse($"Error retrieving creatives: {ex.Message}"));
        }
    }

    // GET /api/creatives/{id}/validate-for-screen/{screenId}
    [HttpGet("{id}/validate-for-screen/{screenId}")]
    public async Task<ActionResult<ApiResponse<CreativeValidationDto>>> ValidateForScreen(Guid id, Guid screenId)
    {
        try
        {
            var query = new CCMS.Application.Features.Creatives.Queries.ValidateCreativeForScreenQuery
            {
                CreativeId = id,
                ScreenId = screenId
            };

            var result = await _mediator.Send(query);
            return Ok(ApiResponse<CreativeValidationDto>.SuccessResponse(result));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<CreativeValidationDto>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            return StatusCode(500,
                ApiResponse<CreativeValidationDto>.ErrorResponse($"Error validating creative: {ex.Message}"));
        }
    }
}
