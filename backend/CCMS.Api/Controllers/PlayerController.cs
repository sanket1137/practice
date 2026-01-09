using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using CCMS.Api.Hubs;
using CCMS.Application.Services;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Player;

namespace CCMS.Api.Controllers;

[ApiController]
[Route("api/player")]
public class PlayerController : ControllerBase
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly PlaylistGeneratorService _playlistService;
    private readonly IRepository<Impression> _impressionRepository;
    private readonly IHubContext<PlayerHub> _hubContext;
    private readonly ILogger<PlayerController> _logger;
    private readonly ITimeZoneService _timeZoneService;

    public PlayerController(
        IRepository<Screen> screenRepository,
        PlaylistGeneratorService playlistService,
        IRepository<Impression> impressionRepository,
        IHubContext<PlayerHub> hubContext,
        ILogger<PlayerController> logger,
        ITimeZoneService timeZoneService)
    {
        _screenRepository = screenRepository;
        _playlistService = playlistService;
        _impressionRepository = impressionRepository;
        _hubContext = hubContext;
        _logger = logger;
        _timeZoneService = timeZoneService;
    }

    /// <summary>
    /// Player handshake - called once when player starts
    /// </summary>
    [HttpPost("handshake")]
    public async Task<ActionResult<ApiResponse<HandshakeResponse>>> Handshake([FromBody] HandshakeRequest request)
    {
        try
        {
            _logger.LogInformation($"Handshake request from screen: {request.ScreenId}");

            if (!Guid.TryParse(request.ScreenId, out var screenGuid))
            {
                return BadRequest(ApiResponse<HandshakeResponse>.ErrorResponse("Invalid screen ID"));
            }

            var screen = await _screenRepository.GetByIdAsync(screenGuid);
            if (screen == null)
            {
                _logger.LogWarning($"Handshake failed: Screen not found {request.ScreenId}");
                return NotFound(ApiResponse<HandshakeResponse>.ErrorResponse("Screen not found"));
            }

            // TODO: Implement API key verification with BCrypt
            // For now, accept any API key
            if (string.IsNullOrEmpty(screen.ApiKeyHash))
            {
                _logger.LogWarning($"Screen {request.ScreenId} has no API key configured");
            }

            // Update screen status
            screen.LastSeenAt = DateTime.UtcNow;
            screen.IsOnline = true;
            await _screenRepository.UpdateAsync(screen);

            // Broadcast status change to dashboard
            await _hubContext.Clients.Group($"screen-{request.ScreenId}")
                .SendAsync("OnScreenStatusChanged", new
                {
                    screenId = request.ScreenId,
                    isOnline = true,
                    lastSeen = screen.LastSeenAt,
                    timestamp = DateTime.UtcNow
                });

            // Get today's playlist using configured timezone
            var currentDate = _timeZoneService.GetCurrentDate();
            _logger.LogInformation($"Generating playlist for {_timeZoneService.TimeZone.Id}: {currentDate:yyyy-MM-dd}");
            var playlist = await _playlistService.GeneratePlaylistAsync(screenGuid, currentDate);


            _logger.LogInformation($"Handshake successful for screen {request.ScreenId}");

            var response = new HandshakeResponse
            {
                Success = true,
                ServerTime = DateTime.UtcNow,
                Playlist = playlist,
                SyncIntervalMinutes = 10,
                Message = "Handshake successful"
            };

            return Ok(ApiResponse<HandshakeResponse>.SuccessResponse(response));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Handshake error for screen {request.ScreenId}");
            return StatusCode(500, ApiResponse<HandshakeResponse>.ErrorResponse($"Handshake failed: {ex.Message}"));
        }
    }

    /// <summary>
    /// Player sync - called every 10 minutes to send accumulated data
    /// </summary>
    [HttpPost("sync")]
    public async Task<ActionResult<ApiResponse<SyncResponse>>> Sync([FromBody] SyncRequest request)
    {
        try
        {
            _logger.LogInformation($"Sync request from screen: {request.ScreenId}");

            if (!Guid.TryParse(request.ScreenId, out var screenGuid))
            {
                return BadRequest(ApiResponse<SyncResponse>.ErrorResponse("Invalid screen ID"));
            }

            var screen = await _screenRepository.GetByIdAsync(screenGuid);
            if (screen == null)
            {
                return NotFound(ApiResponse<SyncResponse>.ErrorResponse("Screen not found"));
            }

            // Update screen status
            screen.LastSeenAt = DateTime.UtcNow;
            screen.IsOnline = true;
            await _screenRepository.UpdateAsync(screen);

            // Save impressions
            int savedCount = 0;
            foreach (var campaign in request.SyncData.CampaignImpressions)
            {
                foreach (var timestamp in campaign.PlayTimestamps)
                {
                    var impression = new Impression
                    {
                        Id = Guid.NewGuid(),
                        ScreenId = screenGuid,
                        BookingId = campaign.BookingId,
                        CampaignId = campaign.CampaignId,
                        CreativeId = campaign.CreativeId,
                        PlayedAt = timestamp,
                        SessionDate = timestamp.Date,
                        DeviceId = request.ScreenId,
                        CreatedAt = DateTime.UtcNow
                    };

                    await _impressionRepository.AddAsync(impression);
                    savedCount++;
                }
            }

            // Save owner content impressions (NEW)
            foreach (var ownerContent in request.SyncData.OwnerContentImpressions)
            {
                foreach (var timestamp in ownerContent.PlayTimestamps)
                {
                    var impression = new Impression
                    {
                        Id = Guid.NewGuid(),
                        ScreenId = screenGuid,
                        OwnerContentId = ownerContent.OwnerContentId,
                        // For owner content, these are NULL since no booking involved
                        BookingId = null,
                        CampaignId = null,
                        CreativeId = null,
                        PlayedAt = timestamp,
                        SessionDate = timestamp.Date,
                        DeviceId = request.ScreenId,
                        SlotPosition = ownerContent.SlotNumber,
                        CreatedAt = DateTime.UtcNow
                    };

                    await _impressionRepository.AddAsync(impression);
                    savedCount++;
                    
                    // Broadcast impression event for real-time updates
                    await _hubContext.Clients.Group($"screen-{request.ScreenId}")
                        .SendAsync("ImpressionRecorded", new
                        {
                            screenId = request.ScreenId,
                            slotNumber = ownerContent.SlotNumber,
                            ownerContentId = ownerContent.OwnerContentId,
                            timestamp = timestamp
                        });
                }
            }

            // Broadcast sync event to dashboard
            await _hubContext.Clients.Group($"screen-{request.ScreenId}")
                .SendAsync("OnPlayerSync", new
                {
                    screenId = request.ScreenId,
                    uptime = request.SyncData.Uptime,
                    impressionCount = savedCount,
                    timestamp = DateTime.UtcNow
                });

            _logger.LogInformation($"Sync successful for screen {request.ScreenId}: {savedCount} impressions saved");

            var response = new SyncResponse
            {
                Success = true,
                Message = "Sync successful",
                ImpressionsSaved = savedCount
            };

            return Ok(ApiResponse<SyncResponse>.SuccessResponse(response));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Sync error for screen {request.ScreenId}");
            return StatusCode(500, ApiResponse<SyncResponse>.ErrorResponse($"Sync failed: {ex.Message}"));
        }
    }

    /// <summary>
    /// Player heartbeat - called every 30 seconds to maintain online status
    /// </summary>
    [HttpPost("heartbeat")]
    public async Task<ActionResult<ApiResponse<HeartbeatResponse>>> Heartbeat([FromBody] HeartbeatRequest request)
    {
        try
        {
            if (!Guid.TryParse(request.ScreenId, out var screenGuid))
            {
                return BadRequest(ApiResponse<HeartbeatResponse>.ErrorResponse("Invalid screen ID"));
            }

            var screen = await _screenRepository.GetByIdAsync(screenGuid);
            if (screen == null)
            {
                return NotFound(ApiResponse<HeartbeatResponse>.ErrorResponse("Screen not found"));
            }

            // Update last seen timestamp
            var wasOffline = !screen.IsOnline;
            screen.LastSeenAt = DateTime.UtcNow;
            screen.IsOnline = true;
            await _screenRepository.UpdateAsync(screen);

            // If screen was offline and now online, broadcast status change
            if (wasOffline)
            {
                _logger.LogInformation($"Screen {request.ScreenId} came online");
                await _hubContext.Clients.Group($"screen-{request.ScreenId}")
                    .SendAsync("OnScreenStatusChanged", new
                    {
                        screenId = request.ScreenId,
                        isOnline = true,
                        lastSeen = screen.LastSeenAt,
                        timestamp = DateTime.UtcNow
                    });
            }

            var response = new HeartbeatResponse
            {
                Success = true,
                ServerTime = DateTime.UtcNow
            };

            return Ok(ApiResponse<HeartbeatResponse>.SuccessResponse(response));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Heartbeat error for screen {request.ScreenId}");
            return StatusCode(500, ApiResponse<HeartbeatResponse>.ErrorResponse($"Heartbeat failed: {ex.Message}"));
        }
    }
}

// Request/Response DTOs
public class HandshakeRequest
{
    public string ScreenId { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string PlayerVersion { get; set; } = string.Empty;
}

public class SyncRequest
{
    public string ScreenId { get; set; } = string.Empty;
    public DailySyncData SyncData { get; set; } = null!;
}

public class HeartbeatRequest
{
    public string ScreenId { get; set; } = string.Empty;
}

public class HeartbeatResponse
{
    public bool Success { get; set; }
    public DateTime ServerTime { get; set; }
}
