using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using CCMS.Api.Hubs;
using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Player;

namespace CCMS.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PlayerController : ControllerBase
{
    private readonly IPlaylistService _playlistService;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Impression> _impressionRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IHubContext<PlaybackHub> _hubContext;

    public PlayerController(
        IPlaylistService playlistService,
        IRepository<Screen> screenRepository,
        IRepository<Impression> impressionRepository,
        IUnitOfWork unitOfWork,
        IHubContext<PlaybackHub> hubContext)
    {
        _playlistService = playlistService;
        _screenRepository = screenRepository;
        _impressionRepository = impressionRepository;
        _unitOfWork = unitOfWork;
        _hubContext = hubContext;
    }

    [HttpPost("handshake")]
    public async Task<ActionResult<ApiResponse<HandshakeResponse>>> Handshake([FromBody] HandshakeRequest request)
    {
        try
        {
            // Validate device (simplified - in production, use proper device tokens)
            var screen = await _screenRepository.GetByIdAsync(Guid.Parse(request.DeviceId));
            
            if (screen == null)
            {
                return Unauthorized(ApiResponse<HandshakeResponse>.ErrorResponse("Invalid device ID"));
            }

            // Get today's playlist
            var playlist = await _playlistService.GetTodayPlaylistAsync(request.DeviceId);

            var response = new HandshakeResponse
            {
                Success = true,
                Message = "Handshake successful",
                ServerTime = DateTime.UtcNow,
                Playlist = playlist
            };

            return Ok(ApiResponse<HandshakeResponse>.SuccessResponse(response));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<HandshakeResponse>.ErrorResponse($"Handshake failed: {ex.Message}"));
        }
    }

    [HttpGet("playlist")]
    public async Task<ActionResult<ApiResponse<PlaylistDto>>> GetPlaylist([FromQuery] string deviceId)
    {
        try
        {
            var playlist = await _playlistService.GetTodayPlaylistAsync(deviceId);
            return Ok(ApiResponse<PlaylistDto>.SuccessResponse(playlist));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<PlaylistDto>.ErrorResponse($"Error retrieving playlist: {ex.Message}"));
        }
    }

    [HttpPost("impression")]
    public async Task<ActionResult<ApiResponse<object>>> ReportImpression([FromBody] ReportImpressionRequest request)
    {
        try
        {
            // Create impression record
            var impression = new Impression
            {
                BookingId = request.BookingId,
                CreativeId = request.CreativeId,
                ScreenId = Guid.Empty, // Will be set from booking
                PlayTimestamp = request.PlayTimestamp,
                SessionDate = request.PlayTimestamp.Date,
                PlayCount = request.PlayCount,
                DeviceId = request.DeviceId
            };

            await _impressionRepository.AddAsync(impression);
            await _unitOfWork.SaveChangesAsync();

            // Broadcast real-time update via SignalR
            // (In production, you'd fetch the campaign ID from the booking)
            await _hubContext.Clients.All.SendAsync("ImpressionUpdate", new
            {
                BookingId = request.BookingId,
                PlayCount = request.PlayCount,
                Timestamp = request.PlayTimestamp
            });

            return Ok(ApiResponse<object>.SuccessResponse(null, "Impression recorded successfully"));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<object>.ErrorResponse($"Error recording impression: {ex.Message}"));
        }
    }
}
