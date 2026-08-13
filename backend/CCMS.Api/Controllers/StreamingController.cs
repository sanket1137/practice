using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using CCMS.Api.Extensions;
using CCMS.Api.Hubs;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

// This entire controller is WebRTC signaling infrastructure reached directly by
// screens (players) and browser-based viewers over HTTP polling as a fallback
// when SignalR is unreliable. None of these callers carry a user JWT, so the
// class is locked down with [Authorize] and every action is explicitly opted
// out via [AllowAnonymous] (with a reason) rather than left implicitly open.
[Authorize]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[EnableRateLimiting(RateLimitingExtensions.StreamingPolicy)]
public class StreamingController : ControllerBase
{
    private readonly IHubContext<StreamingHub> _hubContext;
    private readonly ILogger<StreamingController> _logger;

    // Static methods below are also invoked from StreamingHub (SignalR), which has
    // no per-request ILogger of its own; capture the first constructed instance's
    // logger for use in those static code paths.
    private static ILogger? _staticLogger;

    // Bound per-screen entry count to avoid unbounded memory growth from screens
    // that are never polled, and cap the number of distinct tracked screens.
    private const int MaxEntriesPerScreen = 50;
    private const int MaxTrackedScreens = 1000;

    /// <summary>
    /// A small thread-safe bounded queue that keeps at most <see cref="MaxEntriesPerScreen"/>
    /// entries per screen, dropping the oldest entry when the cap is exceeded, and
    /// timestamps each entry so a future cleanup pass can evict stale ones.
    /// </summary>
    private sealed class BoundedEntryQueue<T>
    {
        private readonly object _lock = new();
        private readonly Queue<(T Value, DateTime AddedAtUtc)> _items = new();

        public void Add(T value)
        {
            lock (_lock)
            {
                _items.Enqueue((value, DateTime.UtcNow));
                while (_items.Count > MaxEntriesPerScreen)
                {
                    _items.Dequeue(); // drop oldest
                }
            }
        }

        public List<(T Value, DateTime AddedAtUtc)> DrainAll()
        {
            lock (_lock)
            {
                if (_items.Count == 0) return new List<(T, DateTime)>();
                var result = new List<(T, DateTime)>(_items);
                _items.Clear();
                return result;
            }
        }
    }

    // Storage for pending answers from viewers (screenId -> bounded queue of (viewerId, answerSdp, timestamp))
    // Use case-insensitive comparer for screen IDs (GUIDs may differ in case)
    private static readonly ConcurrentDictionary<string, BoundedEntryQueue<(string ViewerId, string AnswerSdp)>> _pendingAnswers =
        new(StringComparer.OrdinalIgnoreCase);

    // Storage for pending ICE candidates from viewers (screenId -> bounded queue of (viewerId, candidate, timestamp))
    private static readonly ConcurrentDictionary<string, BoundedEntryQueue<(string ViewerId, string Candidate)>> _pendingViewerIceCandidates =
        new(StringComparer.OrdinalIgnoreCase);

    public StreamingController(
        IHubContext<StreamingHub> hubContext,
        ILogger<StreamingController> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
        _staticLogger ??= logger;
    }

    /// <summary>
    /// Store an answer from a viewer for HTTP polling by the player
    /// </summary>
    public static void StoreAnswerForPlayer(string screenId, string viewerId, string answerSdp)
    {
        // Normalize to lowercase for consistent lookup
        screenId = screenId.ToLowerInvariant();

        if (!_pendingAnswers.ContainsKey(screenId) && _pendingAnswers.Count >= MaxTrackedScreens)
        {
            _staticLogger?.LogWarning(
                "Ignoring pending answer for screen {ScreenId}: max tracked screens ({MaxTrackedScreens}) reached",
                screenId, MaxTrackedScreens);
            return;
        }

        var queue = _pendingAnswers.GetOrAdd(screenId, _ => new BoundedEntryQueue<(string, string)>());
        queue.Add((viewerId, answerSdp));
    }

    /// <summary>
    /// Store an ICE candidate from a viewer for HTTP polling by the player
    /// </summary>
    public static void StoreViewerIceCandidateForPlayer(string screenId, string viewerId, string candidate)
    {
        // Normalize to lowercase for consistent lookup
        screenId = screenId.ToLowerInvariant();

        if (!_pendingViewerIceCandidates.ContainsKey(screenId) && _pendingViewerIceCandidates.Count >= MaxTrackedScreens)
        {
            _staticLogger?.LogWarning(
                "Ignoring pending ICE candidate for screen {ScreenId}: max tracked screens ({MaxTrackedScreens}) reached",
                screenId, MaxTrackedScreens);
            return;
        }

        var queue = _pendingViewerIceCandidates.GetOrAdd(screenId, _ => new BoundedEntryQueue<(string, string)>());
        queue.Add((viewerId, candidate));
    }

    /// <summary>
    /// Check if a stream is registered and active for a screen
    /// </summary>
    [AllowAnonymous] // Player-facing: screens poll this without a user JWT
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
    [AllowAnonymous] // Player-facing: screens poll this without a user JWT
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

    [AllowAnonymous] // Player-facing: screens register their stream without a user JWT
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
            return StatusCode(500, new { success = false, message = "Failed to register stream." });
        }
    }

    [AllowAnonymous] // Player-facing: screens unregister their stream without a user JWT
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
            _logger.LogError(ex, "Error unregistering stream for screen {ScreenId}", request.ScreenId);
            return StatusCode(500, new { success = false, message = "Failed to unregister stream." });
        }
    }

    [AllowAnonymous] // Player-facing: screens poll for pending viewers without a user JWT
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
            return StatusCode(500, new { success = false, message = "Failed to get pending viewers." });
        }
    }

    /// <summary>
    /// Send WebRTC offer to a viewer via HTTP (fallback when SignalR is unreliable)
    /// </summary>
    [AllowAnonymous] // Player-facing: screens relay signaling messages without a user JWT
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
            return StatusCode(500, new { success = false, message = "Failed to send offer." });
        }
    }

    /// <summary>
    /// Send ICE candidate to a viewer via HTTP
    /// </summary>
    [AllowAnonymous] // Player-facing: screens relay signaling messages without a user JWT
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
            return StatusCode(500, new { success = false, message = "Failed to send ICE candidate." });
        }
    }
    
    /// <summary>
    /// Player polls for pending answers from viewers
    /// </summary>
    [AllowAnonymous] // Player-facing: screens poll for answers without a user JWT
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
                foreach (var item in queue.DrainAll())
                {
                    // Return 'answer' key to match Python polling expectations
                    answers.Add(new { viewerId = item.Value.ViewerId, answer = item.Value.AnswerSdp });
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
            return StatusCode(500, new { success = false, message = "Failed to get pending answers." });
        }
    }

    /// <summary>
    /// Player polls for pending ICE candidates from viewers
    /// </summary>
    [AllowAnonymous] // Player-facing: screens poll for ICE candidates without a user JWT
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
                foreach (var item in queue.DrainAll())
                {
                    candidates.Add(new { viewerId = item.Value.ViewerId, candidate = item.Value.Candidate });
                }
            }

            return Ok(new { candidates });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting pending viewer ICE candidates for screen {ScreenId}", screenId);
            return StatusCode(500, new { success = false, message = "Failed to get pending ICE candidates." });
        }
    }

    /// <summary>
    /// Viewer submits answer via HTTP (for player polling)
    /// </summary>
    [AllowAnonymous] // Player/viewer-facing: browser viewers submit answers without a user JWT
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
            return StatusCode(500, new { success = false, message = "Failed to store answer." });
        }
    }

    /// <summary>
    /// Viewer submits ICE candidate via HTTP (for player polling)
    /// </summary>
    [AllowAnonymous] // Player/viewer-facing: browser viewers submit ICE candidates without a user JWT
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
            return StatusCode(500, new { success = false, message = "Failed to store ICE candidate." });
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
