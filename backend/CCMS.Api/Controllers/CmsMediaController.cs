using System.Security.Claims;
using Asp.Versioning;
using CCMS.Application.Interfaces;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Cms;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CCMS.Api.Controllers;

/// <summary>Media library for CMS-mode owners. Content-addressed uploads via R2 presign.</summary>
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/cms/media")]
[Authorize]
public class CmsMediaController : ControllerBase
{
    private readonly ICmsMediaService _mediaService;

    public CmsMediaController(ICmsMediaService mediaService)
    {
        _mediaService = mediaService;
    }

    [HttpPost("check-sha256")]
    public async Task<ActionResult<ApiResponse<CheckSha256Response>>> CheckSha256(
        [FromBody] CheckSha256Request request, CancellationToken ct)
    {
        try
        {
            var result = await _mediaService.CheckSha256Async(GetUserId(), request.Sha256, ct);
            return Ok(ApiResponse<CheckSha256Response>.SuccessResponse(result));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<CheckSha256Response>.ErrorResponse(ex.Message));
        }
    }

    [HttpPost("presign-upload")]
    public async Task<ActionResult<ApiResponse<PresignUploadResponse>>> Presign(
        [FromBody] PresignUploadRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _mediaService.PresignUploadAsync(GetUserId(), request, ct);
            return Ok(ApiResponse<PresignUploadResponse>.SuccessResponse(result));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<PresignUploadResponse>.ErrorResponse(ex.Message));
        }
    }

    [HttpPost("finalize")]
    public async Task<ActionResult<ApiResponse<MediaAssetDto>>> Finalize(
        [FromBody] FinalizeUploadRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _mediaService.FinalizeUploadAsync(GetUserId(), request, ct);
            return Ok(ApiResponse<MediaAssetDto>.SuccessResponse(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<MediaAssetDto>.ErrorResponse(ex.Message));
        }
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<MediaAssetDto>>>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _mediaService.ListAsync(GetUserId(), page, pageSize, ct);
        return Ok(ApiResponse<PagedResult<MediaAssetDto>>.SuccessResponse(result));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id, CancellationToken ct)
    {
        try
        {
            var deleted = await _mediaService.DeleteAsync(GetUserId(), id, ct);
            if (!deleted)
            {
                return NotFound(ApiResponse<bool>.ErrorResponse("Media asset not found"));
            }
            return Ok(ApiResponse<bool>.SuccessResponse(true, "Deleted"));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<bool>.ErrorResponse(ex.Message));
        }
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(claim, out var id))
        {
            throw new UnauthorizedAccessException("Invalid user claim");
        }
        return id;
    }
}
