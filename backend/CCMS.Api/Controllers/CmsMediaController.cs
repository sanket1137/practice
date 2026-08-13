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
        [FromQuery] string? search,
        [FromQuery] string? tags,            // comma-separated
        [FromQuery] Guid? collectionId,
        [FromQuery] string? assetType,       // Image | Video | Html | Other
        [FromQuery] bool favoritesOnly = false,
        [FromQuery] bool recentlyUsed = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var filters = new MediaLibraryFilters
        {
            Search = search,
            Tags = string.IsNullOrWhiteSpace(tags)
                ? null
                : tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                      .Select(t => t.ToLowerInvariant())
                      .ToList(),
            CollectionId = collectionId,
            AssetType = assetType,
            FavoritesOnly = favoritesOnly,
            RecentlyUsed = recentlyUsed,
            Page = page,
            PageSize = pageSize
        };
        var result = await _mediaService.ListAsync(GetUserId(), filters, ct);
        return Ok(ApiResponse<PagedResult<MediaAssetDto>>.SuccessResponse(result));
    }

    [HttpPatch("{id}")]
    public async Task<ActionResult<ApiResponse<MediaAssetDto>>> Update(
        Guid id, [FromBody] UpdateMediaAssetRequest request, CancellationToken ct)
    {
        try
        {
            var dto = await _mediaService.UpdateAssetAsync(GetUserId(), id, request, ct);
            return Ok(ApiResponse<MediaAssetDto>.SuccessResponse(dto));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<MediaAssetDto>.ErrorResponse(ex.Message));
        }
    }

    [HttpPost("{id}/favorite")]
    public async Task<ActionResult<ApiResponse<bool>>> ToggleFavorite(Guid id, CancellationToken ct)
    {
        try
        {
            var isFav = await _mediaService.ToggleFavoriteAsync(GetUserId(), id, ct);
            return Ok(ApiResponse<bool>.SuccessResponse(isFav));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse<bool>.ErrorResponse(ex.Message));
        }
    }

    [HttpGet("collections")]
    public async Task<ActionResult<ApiResponse<List<MediaCollectionDto>>>> ListCollections(CancellationToken ct)
    {
        var result = await _mediaService.ListCollectionsAsync(GetUserId(), ct);
        return Ok(ApiResponse<List<MediaCollectionDto>>.SuccessResponse(result));
    }

    [HttpPost("collections")]
    public async Task<ActionResult<ApiResponse<MediaCollectionDto>>> CreateCollection(
        [FromBody] CreateMediaCollectionRequest request, CancellationToken ct)
    {
        try
        {
            var dto = await _mediaService.CreateCollectionAsync(GetUserId(), request, ct);
            return Ok(ApiResponse<MediaCollectionDto>.SuccessResponse(dto));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<MediaCollectionDto>.ErrorResponse(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<MediaCollectionDto>.ErrorResponse(ex.Message));
        }
    }

    [HttpDelete("collections/{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteCollection(Guid id, CancellationToken ct)
    {
        var deleted = await _mediaService.DeleteCollectionAsync(GetUserId(), id, ct);
        if (!deleted)
        {
            return NotFound(ApiResponse<bool>.ErrorResponse("Collection not found"));
        }
        return Ok(ApiResponse<bool>.SuccessResponse(true, "Deleted"));
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
