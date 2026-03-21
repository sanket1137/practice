using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using CCMS.Api.Extensions;
using CCMS.Api.Hubs;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[EnableRateLimiting(RateLimitingExtensions.StreamingPolicy)]
public class StreamingController : ControllerBase
{
    private readonly IHubContext<StreamingHub> _hubContext;
    private readonly ILogger<StreamingController> _logger;

    // Storage for pending answers from viewers (screenId -> list of (viewerId, answerSdp))
    // Use case-insensitive comparer for screen IDs (GUIDs may differ in case)
    private static readonly ConcurrentDictionary<string, ConcurrentQueue<(string ViewerId, string AnswerSdp)>> _pendingAnswers = 
        new(StringComparer.OrdinalIgnoreCase);
    
    // Storage for pending ICE candidates from viewers (screenId -> list of (viewerId, candidate))
    private static readonly ConcurrentDictionary<string, ConcurrentQueue<(string ViewerId, string Candidate)>> _pendingViewerIceCandidates = 
        new(StringComparer.OrdinalIgnoreCase);

    public StreamingController(
        IHubContext<StreamingHub> hubContext,
        ILogger<StreamingController> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }
    
    /// <summary>
    /// Store an answer from a viewer for HTTP polling by the player
    /// </summary>
    public static void StoreAnswerForPlayer(string screenId, string viewerId, string answerSdp)
    {
        // Normalize to lowercase for consistent lookup
        screenId = screenId.ToLowerInvariant();
        var queue = _pendingAnswers.GetOrAdd(screenId, _ => new ConcurrentQueue<(string, string)>());
        queue.Enqueue((viewerId, answerSdp));
    }
    
    /// <summary>
    /// Store an ICE candidate from a viewer for HTTP polling by the player
    /// </summary>
    public static void StoreViewerIceCandidateForPlayer(string screenId, string viewerId, string candidate)
    {
        // Normalize to lowercase for consistent lookup
        screenId = screenId.ToLowerInvariant();
        var queue = _pendingViewerIceCandidates.GetOrAdd(screenId, _ => new ConcurrentQueue<(string, string)>());
        queue.Enqueue((viewerId, candidate));
    }

    /// <summary>
    /// Check if a stream is registered and active for a screen
    /// </summary>
    [HttpGet("status/{screenId}")]
    public IActionResult GetStreamStatus(string screenId)
    {
        screenId = screenId.ToLowerInvariant();
        var isRegistered = StreamingHub.IsStreamRegistered(screenId);
        return Ok(new { 
            screenId = screenId, 
            isActive = isRegistered,
            message = isRegistered ? "Stream is active" : "Stream is not active"
        });
    }
    
    /// <summary>
    /// Get current viewer count for a stream (for capacity checking)
    /// </summary>
    [HttpGet("viewer-count/{screenId}")]
    public IActionResult GetViewerCount(string screenId)
    {
        screenId = screenId.ToLowerInvariant();
        var viewerCount = StreamingHub.GetViewerCount(screenId);
        var isRegistered = StreamingHub.IsStreamRegistered(screenId);
        
        return Ok(new { 
            screenId = screenId, 
            viewerCount = viewerCount,
            isActive = isRegistered,
            message = isRegistered ? $"Stream has {viewerCount} viewer(s)" : "Stream is not active"
        });
    }

    [HttpPost("register")]
    public IActionResult RegisterStream([FromBody] RegisterStreamRequest request)
    {
        try
        {
            _logger.LogInformation(
                "HTTP: Registering stream for screen {ScreenId}",
                request.ScreenId);

            // Add to active streams (accessing static dictionary)
            var success = StreamingHub.RegisterStreamFromHttp(request.ScreenId, request.ConnectionId ?? "http-player");
            
            if (success)
            {
                _logger.LogInformation("Stream registered successfully for screen {ScreenId}", request.ScreenId);
                return Ok(new { success = true, message = "Stream registered successfully" });
            }
            else
            {
                _logger.LogWarning("Stream already registered for screen {ScreenId}", request.ScreenId);
                return Ok(new { success = true, message = "Stream already active" });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error registering stream for screen {ScreenId}", request.ScreenId);
            return StatusCode(500, new { success = false, message = ex.Message });
        }
    }

    [HttpPost("unregister")]
    public IActionResult UnregisterStream([FromBody] UnregisterStreamRequest request)
    {
        try
        {
            _logger.LogInformation("HTTP: Unregistering stream for screen {ScreenId}", request.ScreenId);
            
            StreamingHub.UnregisterStreamFromHttp(request.ScreenId);
            
            return Ok(new { success = true, message = "Stream unregistered" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unregistering stream");
            return StatusCode(500, new { success = false, message = ex.Message });
        }
    }
    
    [HttpGet("pending-viewers/{screenId}")]
    public IActionResult GetPendingViewers(string screenId)
    {
        try
        {
            var viewers = StreamingHub.GetPendingViewers(screenId);
            return Ok(new { viewers = viewers });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting pending viewers for screen {ScreenId}", screenId);
            return StatusCode(500, new { success = false, message = ex.Message });
        }
    }

    /// <summary>
    /// Send WebRTC offer to a viewer via HTTP (fallback when SignalR is unreliable)
    /// </summary>
    [HttpPost("send-offer")]
    public async Task<IActionResult> SendOffer([FromBody] SendOfferRequest request)
    {
        try
        {
            _logger.LogInformation(
                "HTTP: Sending offer to viewer {ViewerId}",
                request.ViewerId);

            await _hubContext.Clients.Client(request.ViewerId)
                .SendAsync("OnOffer", request.OfferSdp);

            return Ok(new { success = true, message = "Offer sent" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending offer to viewer {ViewerId}", request.ViewerId);
            return StatusCode(500, new { success = false, message = ex.Message });
        }
    }

    /// <summary>
    /// Send ICE candidate to a viewer via HTTP
    /// </summary>
    [HttpPost("send-ice-candidate")]
    public async Task<IActionResult> SendIceCandidate([FromBody] SendIceCandidateRequest request)
    {
        try
        {
            await _hubContext.Clients.Client(request.ViewerId)
                .SendAsync("OnIceCandidate", request.Candidate);

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending ICE candidate to viewer {ViewerId}", request.ViewerId);
            return StatusCode(500, new { success = false, message = ex.Message });
        }
    }
    
    /// <summary>
    /// Player polls for pending answers from viewers
    /// </summary>
    [HttpGet("pending-answers/{screenId}")]
    public IActionResult GetPendingAnswers(string screenId)
    {
        try
        {
            // Normalize to lowercase for consistent lookup
            screenId = screenId.ToLowerInvariant();
            var answers = new List<object>();
            
            if (_pendingAnswers.TryGetValue(screenId, out var queue))
            {
                while (queue.TryDequeue(out var item))
                {
                    // Return 'answer' key to match Python polling expectations
                    answers.Add(new { viewerId = item.ViewerId, answer = item.AnswerSdp });
                }
            }
            
            if (answers.Count > 0)
            {
                _logger.LogInformation(
                    "HTTP: Returning {Count} pending answers for screen {ScreenId}",
                    answers.Count, screenId);
            }
            
            return Ok(new { answers });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting pending answers for screen {ScreenId}", screenId);
            return StatusCode(500, new { success = false, message = ex.Message });
        }
    }
    
    /// <summary>
    /// Player polls for pending ICE candidates from viewers
    /// </summary>
    [HttpGet("pending-viewer-ice/{screenId}")]
    public IActionResult GetPendingViewerIceCandidates(string screenId)
    {
        try
        {
            // Normalize to lowercase for consistent lookup
            screenId = screenId.ToLowerInvariant();
            var candidates = new List<object>();
            
            if (_pendingViewerIceCandidates.TryGetValue(screenId, out var queue))
            {
                while (queue.TryDequeue(out var item))
                {
                    candidates.Add(new { viewerId = item.ViewerId, candidate = item.Candidate });
                }
            }
            
            return Ok(new { candidates });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting pending viewer ICE candidates for screen {ScreenId}", screenId);
            return StatusCode(500, new { success = false, message = ex.Message });
        }
    }
    
    /// <summary>
    /// Viewer submits answer via HTTP (for player polling)
    /// </summary>
    [HttpPost("submit-answer")]
    public IActionResult SubmitAnswer([FromBody] SubmitAnswerRequest request)
    {
        try
        {
            _logger.LogInformation(
                "HTTP: Viewer {ViewerId} submitting answer for screen {ScreenId}",
                request.ViewerId, request.ScreenId);
                
            StoreAnswerForPlayer(request.ScreenId, request.ViewerId, request.AnswerSdp);
            
            return Ok(new { success = true, message = "Answer stored for player" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error storing answer from viewer {ViewerId}", request.ViewerId);
            return StatusCode(500, new { success = false, message = ex.Message });
        }
    }
    
    /// <summary>
    /// Viewer submits ICE candidate via HTTP (for player polling)
    /// </summary>
    [HttpPost("submit-viewer-ice")]
    public IActionResult SubmitViewerIceCandidate([FromBody] SubmitViewerIceRequest request)
    {
        try
        {
            StoreViewerIceCandidateForPlayer(request.ScreenId, request.ViewerId, request.Candidate);
            
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error storing viewer ICE candidate from {ViewerId}", request.ViewerId);
            return StatusCode(500, new { success = false, message = ex.Message });
        }
    }
}

public class RegisterStreamRequest
{
    public string ScreenId { get; set; } = string.Empty;
    public string? ConnectionId { get; set; }
    public string? ApiKey { get; set; }
}

public class UnregisterStreamRequest
{
    public string ScreenId { get; set; } = string.Empty;
}

public class SendOfferRequest
{
    public string ViewerId { get; set; } = string.Empty;
    public string OfferSdp { get; set; } = string.Empty;
}

public class SendIceCandidateRequest
{
    public string ViewerId { get; set; } = string.Empty;
    public string Candidate { get; set; } = string.Empty;
}

public class SubmitAnswerRequest
{
    public string ScreenId { get; set; } = string.Empty;
    public string ViewerId { get; set; } = string.Empty;
    public string AnswerSdp { get; set; } = string.Empty;
}

public class SubmitViewerIceRequest
{
    public string ScreenId { get; set; } = string.Empty;
    public string ViewerId { get; set; } = string.Empty;
    public string Candidate { get; set; } = string.Empty;
}
