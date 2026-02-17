using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Application.Interfaces;
using CCMS.Shared.Common;
using CCMS.Application.Helpers;

namespace CCMS.Api.Controllers;

[ApiController]
[Route("api/screens")]
public class ScreenDefaultVideoController : ControllerBase
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly IFileStorageService _fileStorageService;
    private readonly ILogger<ScreenDefaultVideoController> _logger;
    private readonly IUnitOfWork _unitOfWork;
    private readonly string _r2PublicUrlBase;
    private const long MaxVideoSizeBytes = 52428800; // 50MB

    public ScreenDefaultVideoController(
        IRepository<Screen> screenRepository,
        IFileStorageService fileStorageService,
        ILogger<ScreenDefaultVideoController> logger,
        IUnitOfWork unitOfWork,
        IConfiguration configuration)
    {
        _screenRepository = screenRepository;
        _fileStorageService = fileStorageService;
        _logger = logger;
        _unitOfWork = unitOfWork;
        _r2PublicUrlBase = configuration["R2:PublicUrlBase"] ?? "";
    }

    /// <summary>
    /// Upload custom default video for a screen
    /// </summary>
    [HttpPost("{screenId}/default-video")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<ApiResponse<object>>> UploadDefaultVideo(
        Guid screenId,
        [FromForm] IFormFile video)
    {
        try
        {
            // Get screen
            var screen = await _screenRepository.GetByIdAsync(screenId);
            if (screen == null)
            {
                return NotFound(ApiResponse<object>.ErrorResponse("Screen not found"));
            }

            // Validate ownership (simplified for MVP)
            // TODO: Add proper ownership validation when auth is fully implemented

            // Validate video file
            if (video == null || video.Length == 0)
            {
                return BadRequest(ApiResponse<object>.ErrorResponse("No video file uploaded"));
            }

            if (video.Length > MaxVideoSizeBytes)
            {
                return BadRequest(ApiResponse<object>.ErrorResponse(
                    $"Video file too large. Maximum size is {MaxVideoSizeBytes / 1048576}MB"));
            }

            // Validate video format (MP4 only)
            var allowedExtensions = new[] { ".mp4" };
            var extension = Path.GetExtension(video.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest(ApiResponse<object>.ErrorResponse(
                    "Invalid video format. Only MP4 files are supported"));
            }

            // Delete old default video if exists
            if (!string.IsNullOrEmpty(screen.DefaultVideoUrl))
            {
                try
                {
                    await _fileStorageService.DeleteFileAsync(screen.DefaultVideoUrl);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to delete old default video");
                }
            }

            // Upload new video
            var fileName = $"default-videos/screen_{screenId}{extension}";
            var videoUrl = await _fileStorageService.UploadFileAsync(
                video.OpenReadStream(), 
                fileName, 
                video.ContentType);

            // Update screen
            screen.DefaultVideoUrl = videoUrl;
            screen.HasCustomDefaultVideo = true;
            screen.DefaultVideoUploadedAt = DateTime.UtcNow;
            screen.DefaultVideoSizeBytes = video.Length;

            await _screenRepository.UpdateAsync(screen);
            await _unitOfWork.SaveChangesAsync();

            _logger.LogInformation(
                "Default video uploaded for screen {ScreenId}: {VideoUrl}",
                screenId, videoUrl);

            return Ok(ApiResponse<object>.SuccessResponse(new
            {
                videoUrl = MediaUrlHelper.ToProxyUrl(videoUrl, _r2PublicUrlBase) ?? videoUrl,
                uploadedAt = screen.DefaultVideoUploadedAt,
                sizeBytes = screen.DefaultVideoSizeBytes
            }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading default video for screen {ScreenId}", screenId);
            return StatusCode(500, ApiResponse<object>.ErrorResponse(
                "Failed to upload default video"));
        }
    }

    /// <summary>
    /// Delete custom default video and revert to universal default
    /// </summary>
    [HttpDelete("{screenId}/default-video")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteDefaultVideo(Guid screenId)
    {
        try
        {
            var screen = await _screenRepository.GetByIdAsync(screenId);
            if (screen == null)
            {
                return NotFound(ApiResponse<object>.ErrorResponse("Screen not found"));
            }

            // Delete video file if exists
            if (!string.IsNullOrEmpty(screen.DefaultVideoUrl))
            {
                try
                {
                    await _fileStorageService.DeleteFileAsync(screen.DefaultVideoUrl);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to delete default video file");
                }
            }

            // Update screen to use universal default
            screen.DefaultVideoUrl = null;
            screen.HasCustomDefaultVideo = false;
            screen.DefaultVideoUploadedAt = null;
            screen.DefaultVideoSizeBytes = null;

            await _screenRepository.UpdateAsync(screen);
            await _unitOfWork.SaveChangesAsync();

            _logger.LogInformation(
                "Default video deleted for screen {ScreenId}, reverted to universal",
                screenId);

            return Ok(ApiResponse<object>.SuccessResponse(new
            {
                message = "Default video deleted, using universal default"
            }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting default video for screen {ScreenId}", screenId);
            return StatusCode(500, ApiResponse<object>.ErrorResponse(
                "Failed to delete default video"));
        }
    }

    /// <summary>
    /// Get current default video information for a screen
    /// </summary>
    [HttpGet("{screenId}/default-video")]
    public async Task<ActionResult<ApiResponse<object>>> GetDefaultVideoInfo(Guid screenId)
    {
        try
        {
            var screen = await _screenRepository.GetByIdAsync(screenId);
            if (screen == null)
            {
                return NotFound(ApiResponse<object>.ErrorResponse("Screen not found"));
            }

            return Ok(ApiResponse<object>.SuccessResponse(new
            {
                hasCustomVideo = screen.HasCustomDefaultVideo,
                videoUrl = MediaUrlHelper.ToProxyUrl(screen.DefaultVideoUrl, _r2PublicUrlBase),
                uploadedAt = screen.DefaultVideoUploadedAt,
                sizeBytes = screen.DefaultVideoSizeBytes,
                isUsingUniversal = !screen.HasCustomDefaultVideo
            }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting default video info for screen {ScreenId}", screenId);
            return StatusCode(500, ApiResponse<object>.ErrorResponse(
                "Failed to get default video information"));
        }
    }
}
