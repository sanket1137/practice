using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CCMS.Application.Features.Creatives.Commands;
using CCMS.Application.Features.Creatives.Queries;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Creatives;
using CCMS.Application.Helpers;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

[Authorize]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
public class CreativesController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IRepository<Creative> _creativeRepository;
    private readonly string _r2PublicUrlBase;

    public CreativesController(IMediator mediator, IRepository<Creative> creativeRepository, IConfiguration configuration)
    {
        _mediator = mediator;
        _creativeRepository = creativeRepository;
        _r2PublicUrlBase = configuration["R2:PublicUrlBase"] ?? "";
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
        [FromForm] Guid? campaignId, 
        [FromForm] string name, 
        [FromForm] int duration = 10,
        [FromForm] int? width = null,
        [FromForm] int? height = null)
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
                Width = width,  // Nullable - if provided, overrides auto-detection
                Height = height // Nullable - if provided, overrides auto-detection
            };

            var result = await _mediator.Send(command);
            result.FileUrl = MediaUrlHelper.ToProxyUrl(result.FileUrl, _r2PublicUrlBase) ?? result.FileUrl;
            result.ThumbnailUrl = MediaUrlHelper.ToProxyUrl(result.ThumbnailUrl, _r2PublicUrlBase);
            return CreatedAtAction(nameof(GetById), new { id = result.Id },
                ApiResponse<CreativeDto>.SuccessResponse(result, "Creative uploaded successfully"));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<CreativeDto>.ErrorResponse(ex.Message));
        }
        catch (UnauthorizedAccessException)
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
                FileUrl = MediaUrlHelper.ToProxyUrl(creative.FileUrl, _r2PublicUrlBase) ?? creative.FileUrl,
                FileName = creative.FileName,
                MimeType = creative.MimeType,
                FileSize = creative.FileSize,
                Width = creative.Width,
                Height = creative.Height,
                Duration = creative.Duration,
                ThumbnailUrl = MediaUrlHelper.ToProxyUrl(creative.ThumbnailUrl, _r2PublicUrlBase),
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

    // GET /api/creatives/my — owner's creatives (uploaded without a campaign)
    [HttpGet("my")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<IEnumerable<CreativeDto>>>> GetMyCreatives()
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var creatives = await _creativeRepository.FindAsync(c => c.UploadedById == userId);
            var result = creatives.Select(c => MapToDto(c));

            return Ok(ApiResponse<IEnumerable<CreativeDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            return StatusCode(500,
                ApiResponse<IEnumerable<CreativeDto>>.ErrorResponse($"Error retrieving creatives: {ex.Message}"));
        }
    }

    // GET /api/creatives/library — full media library for the current user (any role).
    // Returns ALL non-deleted creatives the user owns (attached or unattached).
    [HttpGet("library")]
    public async Task<ActionResult<ApiResponse<IEnumerable<CreativeDto>>>> GetLibrary()
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var creatives = await _creativeRepository.FindAsync(c => c.UploadedById == userId);
            var result = creatives
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => MapToDto(c));
            return Ok(ApiResponse<IEnumerable<CreativeDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            return StatusCode(500,
                ApiResponse<IEnumerable<CreativeDto>>.ErrorResponse($"Error retrieving library: {ex.Message}"));
        }
    }

    // PATCH /api/creatives/{id} — update metadata (name, duration) for an owned creative.
    [HttpPatch("{id}")]
    public async Task<ActionResult<ApiResponse<CreativeDto>>> UpdateMetadata(Guid id, [FromBody] UpdateCreativeRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var creative = await _creativeRepository.GetByIdAsync(id);
            if (creative == null)
                return NotFound(ApiResponse<CreativeDto>.ErrorResponse("Creative not found"));
            if (creative.UploadedById != userId && !User.IsInRole("Admin"))
                return Forbid();

            if (!string.IsNullOrWhiteSpace(request.Name))
                creative.Name = request.Name.Trim();
            if (request.Duration is > 0)
                creative.Duration = request.Duration.Value;
            creative.UpdatedAt = DateTime.UtcNow;

            await _creativeRepository.UpdateAsync(creative);
            await _creativeRepository.SaveChangesAsync();
            return Ok(ApiResponse<CreativeDto>.SuccessResponse(MapToDto(creative), "Creative updated"));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<CreativeDto>.ErrorResponse($"Error updating creative: {ex.Message}"));
        }
    }

    // DELETE /api/creatives/{id} — soft-delete an owned creative.
    // Refuses to delete if the creative is locked (linked to an approved/active booking).
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var creative = await _creativeRepository.GetByIdAsync(id);
            if (creative == null)
                return NotFound(ApiResponse<object>.ErrorResponse("Creative not found"));
            if (creative.UploadedById != userId && !User.IsInRole("Admin"))
                return Forbid();
            if (creative.IsLocked)
                return Conflict(ApiResponse<object>.ErrorResponse(
                    creative.LockedReason ?? "Creative is locked to an active booking and cannot be deleted."));

            await _creativeRepository.DeleteAsync(id);
            await _creativeRepository.SaveChangesAsync();
            return Ok(ApiResponse<object>.SuccessResponse(new { id }, "Creative deleted"));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<object>.ErrorResponse($"Error deleting creative: {ex.Message}"));
        }
    }

    // POST /api/creatives/{id}/attach — attach an existing library creative to a campaign.
    // If already attached elsewhere, clones the asset under the new campaign (shared FileUrl).
    [HttpPost("{id}/attach")]
    public async Task<ActionResult<ApiResponse<CreativeDto>>> AttachToCampaign(
        Guid id,
        [FromBody] AttachCreativeRequest request,
        [FromServices] IRepository<Campaign> campaignRepository)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var creative = await _creativeRepository.GetByIdAsync(id);
            if (creative == null)
                return NotFound(ApiResponse<CreativeDto>.ErrorResponse("Creative not found"));
            if (creative.UploadedById != userId && !User.IsInRole("Admin"))
                return Forbid();

            var campaign = await campaignRepository.GetByIdAsync(request.CampaignId);
            if (campaign == null)
                return NotFound(ApiResponse<CreativeDto>.ErrorResponse("Campaign not found"));
            if (campaign.AdvertiserId != userId && !User.IsInRole("Admin"))
                return Forbid();

            // If creative not yet attached, attach in place.
            if (creative.CampaignId == null)
            {
                creative.CampaignId = request.CampaignId;
                creative.UpdatedAt = DateTime.UtcNow;
                await _creativeRepository.UpdateAsync(creative);
                await _creativeRepository.SaveChangesAsync();
                return Ok(ApiResponse<CreativeDto>.SuccessResponse(MapToDto(creative), "Creative attached"));
            }

            // Already attached: same campaign → idempotent.
            if (creative.CampaignId == request.CampaignId)
                return Ok(ApiResponse<CreativeDto>.SuccessResponse(MapToDto(creative), "Already attached"));

            // Already attached to a different campaign: clone the asset for the new campaign,
            // preserving review status so an approved library creative stays approved.
            var clone = new Creative
            {
                Id = Guid.NewGuid(),
                CampaignId = request.CampaignId,
                UploadedById = creative.UploadedById,
                Name = creative.Name,
                FileUrl = creative.FileUrl,
                FileName = creative.FileName,
                MimeType = creative.MimeType,
                FileSize = creative.FileSize,
                FileHash = creative.FileHash,
                Width = creative.Width,
                Height = creative.Height,
                Duration = creative.Duration,
                ThumbnailUrl = creative.ThumbnailUrl,
                Status = creative.Status,
                ReviewNotes = creative.ReviewNotes,
                ReviewedAt = creative.ReviewedAt,
                ReviewedByUserId = creative.ReviewedByUserId,
                MediaAssetId = creative.MediaAssetId,
                CreatedAt = DateTime.UtcNow
            };
            await _creativeRepository.AddAsync(clone);
            await _creativeRepository.SaveChangesAsync();
            return Ok(ApiResponse<CreativeDto>.SuccessResponse(MapToDto(clone), "Creative attached (cloned)"));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<CreativeDto>.ErrorResponse($"Error attaching creative: {ex.Message}"));
        }
    }

    // POST /api/creatives/{id}/detach — detach a creative from its campaign (move back to library).
    [HttpPost("{id}/detach")]
    public async Task<ActionResult<ApiResponse<CreativeDto>>> DetachFromCampaign(Guid id)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var creative = await _creativeRepository.GetByIdAsync(id);
            if (creative == null)
                return NotFound(ApiResponse<CreativeDto>.ErrorResponse("Creative not found"));
            if (creative.UploadedById != userId && !User.IsInRole("Admin"))
                return Forbid();
            if (creative.IsLocked)
                return Conflict(ApiResponse<CreativeDto>.ErrorResponse(
                    creative.LockedReason ?? "Creative is locked to an active booking and cannot be detached."));

            creative.CampaignId = null;
            creative.UpdatedAt = DateTime.UtcNow;
            await _creativeRepository.UpdateAsync(creative);
            await _creativeRepository.SaveChangesAsync();
            return Ok(ApiResponse<CreativeDto>.SuccessResponse(MapToDto(creative), "Creative detached"));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<CreativeDto>.ErrorResponse($"Error detaching creative: {ex.Message}"));
        }
    }

    private CreativeDto MapToDto(Creative c) => new()
    {
        Id = c.Id,
        CampaignId = c.CampaignId,
        Name = c.Name,
        FileUrl = MediaUrlHelper.ToProxyUrl(c.FileUrl, _r2PublicUrlBase) ?? c.FileUrl,
        FileName = c.FileName,
        MimeType = c.MimeType,
        FileSize = c.FileSize,
        Width = c.Width,
        Height = c.Height,
        Duration = c.Duration,
        ThumbnailUrl = MediaUrlHelper.ToProxyUrl(c.ThumbnailUrl, _r2PublicUrlBase),
        Status = c.Status.ToString(),
        ReviewNotes = c.ReviewNotes,
        ReviewedAt = c.ReviewedAt,
        UploadedById = c.UploadedById,
        CreatedAt = c.CreatedAt
    };

    // GET /api/v{version}/campaigns/{campaignId}/creatives
    [HttpGet("~/api/v{version:apiVersion}/campaigns/{campaignId}/creatives")]
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
                FileUrl = MediaUrlHelper.ToProxyUrl(c.FileUrl, _r2PublicUrlBase) ?? c.FileUrl,
                FileName = c.FileName,
                MimeType = c.MimeType,
                FileSize = c.FileSize,
                Width = c.Width,
                Height = c.Height,
                Duration = c.Duration,
                ThumbnailUrl = MediaUrlHelper.ToProxyUrl(c.ThumbnailUrl, _r2PublicUrlBase),
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

    // ==========================================
    // ADMIN REVIEW ENDPOINTS
    // ==========================================

    // GET /api/creatives/admin/queue?status=PendingReview&page=1&pageSize=20
    [HttpGet("admin/queue")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<IEnumerable<AdminCreativeDto>>>> GetAdminQueue(
        [FromQuery] string status = "PendingReview",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        try
        {
            var query = new GetAdminCreativesQuery { Status = status, Page = page, PageSize = pageSize };
            var result = await _mediator.Send(query);
            // Apply proxy URL transform
            foreach (var creative in result)
            {
                creative.FileUrl = MediaUrlHelper.ToProxyUrl(creative.FileUrl, _r2PublicUrlBase) ?? creative.FileUrl;
                creative.ThumbnailUrl = MediaUrlHelper.ToProxyUrl(creative.ThumbnailUrl, _r2PublicUrlBase);
            }
            return Ok(ApiResponse<IEnumerable<AdminCreativeDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<IEnumerable<AdminCreativeDto>>.ErrorResponse($"Error: {ex.Message}"));
        }
    }

    // PUT /api/creatives/{id}/review
    [HttpPut("{id}/review")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<CreativeDto>>> Review(Guid id, [FromBody] ReviewCreativeRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var action = request.Action.ToLower();

            if (action != "approve" && action != "reject")
                return BadRequest(ApiResponse<CreativeDto>.ErrorResponse("Action must be 'approve' or 'reject'"));

            var command = new ReviewCreativeCommand
            {
                CreativeId = id,
                ReviewedByUserId = userId,
                NewStatus = action == "approve" ? CreativeStatus.Approved : CreativeStatus.Rejected,
                ReviewNotes = request.ReviewNotes
            };

            var result = await _mediator.Send(command);
            result.FileUrl = MediaUrlHelper.ToProxyUrl(result.FileUrl, _r2PublicUrlBase) ?? result.FileUrl;
            result.ThumbnailUrl = MediaUrlHelper.ToProxyUrl(result.ThumbnailUrl, _r2PublicUrlBase);
            return Ok(ApiResponse<CreativeDto>.SuccessResponse(result, $"Creative {action}d successfully"));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<CreativeDto>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<CreativeDto>.ErrorResponse($"Error: {ex.Message}"));
        }
    }

    // POST /api/creatives/admin/bulk-approve
    [HttpPost("admin/bulk-approve")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<object>>> BulkApprove([FromBody] BulkApproveRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var command = new BulkApproveCreativesCommand
            {
                CreativeIds = request.CreativeIds,
                ReviewedByUserId = userId
            };

            var count = await _mediator.Send(command);
            return Ok(ApiResponse<object>.SuccessResponse(new { approvedCount = count }, $"{count} creative(s) approved successfully"));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<object>.ErrorResponse($"Error: {ex.Message}"));
        }
    }
}
