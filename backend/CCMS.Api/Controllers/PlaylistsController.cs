using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CCMS.Application.Services;
using CCMS.Shared.Common;
using CCMS.Application.DTOs;

namespace CCMS.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PlaylistsController : ControllerBase
{
    private readonly PlaylistGeneratorService _playlistService;
    private readonly ILogger<PlaylistsController> _logger;

    public PlaylistsController(
        PlaylistGeneratorService playlistService,
        ILogger<PlaylistsController> logger)
    {
        _playlistService = playlistService;
        _logger = logger;
    }

    /// <summary>
    /// Get playlist for a screen on a specific date
    /// </summary>
    [HttpGet("{screenId}")]
    public async Task<ActionResult<ApiResponse<PlaylistResponse>>> GetPlaylist(
        Guid screenId,
        [FromQuery] DateTime? date = null)
    {
        try
        {
            var targetDate = date ?? DateTime.Today;
            _logger.LogInformation($"Generating playlist for screen {screenId} on {targetDate:yyyy-MM-dd}");

            var playlist = await _playlistService.GeneratePlaylistAsync(screenId, targetDate);

            if (playlist == null)
            {
                return NotFound(ApiResponse<PlaylistResponse>.ErrorResponse("Screen not found or not operating on this date"));
            }

            return Ok(ApiResponse<PlaylistResponse>.SuccessResponse(playlist));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error generating playlist for screen {screenId}");
            return StatusCode(500, ApiResponse<PlaylistResponse>.ErrorResponse($"Error generating playlist: {ex.Message}"));
        }
    }

    /// <summary>
    /// Get playlist for a date range (useful for player pre-caching)
    /// </summary>
    [HttpGet("{screenId}/range")]
    public async Task<ActionResult<ApiResponse<List<PlaylistResponse>>>> GetPlaylistRange(
        Guid screenId,
        [FromQuery] DateTime startDate,
        [FromQuery] DateTime endDate)
    {
        try
        {
            if (endDate < startDate)
            {
                return BadRequest(ApiResponse<List<PlaylistResponse>>.ErrorResponse("End date must be after start date"));
            }

            if ((endDate - startDate).TotalDays > 7)
            {
                return BadRequest(ApiResponse<List<PlaylistResponse>>.ErrorResponse("Date range cannot exceed 7 days"));
            }

            var playlists = new List<PlaylistResponse>();
            var currentDate = startDate.Date;

            while (currentDate <= endDate.Date)
            {
                var playlist = await _playlistService.GeneratePlaylistAsync(screenId, currentDate);
                if (playlist != null)
                {
                    playlists.Add(playlist);
                }

                currentDate = currentDate.AddDays(1);
            }

            return Ok(ApiResponse<List<PlaylistResponse>>.SuccessResponse(playlists));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error generating playlist range for screen {screenId}");
            return StatusCode(500, ApiResponse<List<PlaylistResponse>>.ErrorResponse($"Error generating playlists: {ex.Message}"));
        }
    }
}
