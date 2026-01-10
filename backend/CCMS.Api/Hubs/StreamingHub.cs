using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using CCMS.Application.Features.Streaming.Queries;
using CCMS.Domain.Interfaces;
using CCMS.Domain.Entities;
using MediatR;
using System.Collections.Concurrent;

namespace CCMS.Api.Hubs;

/// <summary>
/// SignalR hub for WebRTC signaling between player (broadcaster) and viewers
/// Supports both authenticated and API key-based access
/// </summary>
[Authorize] // Enabled for production - requires valid JWT or API key
public class StreamingHub : Hub
{
    private readonly IMediator _mediator;
    private readonly ILogger<StreamingHub> _logger;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IConfiguration _configuration;
    
    // Track active streams: screenId -> connectionId of player (case-insensitive)
    private static readonly ConcurrentDictionary<string, string> _activeStreams = new(StringComparer.OrdinalIgnoreCase);
    
    // Track viewers: screenId -> list of viewer connectionIds (case-insensitive)
    private static readonly ConcurrentDictionary<string, HashSet<string>> _streamViewers = new(StringComparer.OrdinalIgnoreCase);
    
    // Track connection metadata: connectionId -> screenId (for cleanup)
    private static readonly ConcurrentDictionary<string, string> _connectionToScreen = new();
    
    // Rate limiting: connectionId -> last request timestamp
    private static readonly ConcurrentDictionary<string, DateTime> _rateLimitTracker = new();
    private const int RATE_LIMIT_SECONDS = 1; // Minimum seconds between requests
    
    // Connection state tracking for timeout management
    private static readonly ConcurrentDictionary<string, ConnectionState> _connectionStates = new();
    
    // ICE candidate buffering: connectionId -> list of buffered candidates
    private static readonly ConcurrentDictionary<string, List<string>> _iceCandidateBuffer = new();
    
    // Connection timeout in seconds
    private const int CONNECTION_TIMEOUT_SECONDS = 30;
    
    /// <summary>
    /// Tracks the state of a WebRTC connection
    /// </summary>
    public class ConnectionState
    {
        public string ConnectionId { get; set; } = string.Empty;
        public string ScreenId { get; set; } = string.Empty;
        public WebRTCState State { get; set; } = WebRTCState.New;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime LastActivityAt { get; set; } = DateTime.UtcNow;
        public bool IsTimedOut => (DateTime.UtcNow - LastActivityAt).TotalSeconds > CONNECTION_TIMEOUT_SECONDS;
    }
    
    public enum WebRTCState
    {
        New,
        Connecting,
        Connected,
        Disconnected,
        Failed
    }

    public StreamingHub(
        IMediator mediator, 
        ILogger<StreamingHub> logger,
        IRepository<Screen> screenRepository,
        IConfiguration configuration)
    {
        _mediator = mediator;
        _logger = logger;
        _screenRepository = screenRepository;
        _configuration = configuration;
    }
    
    /// <summary>
    /// Check if rate limit allows this request
    /// </summary>
    private bool CheckRateLimit(string connectionId)
    {
        var now = DateTime.UtcNow;
        if (_rateLimitTracker.TryGetValue(connectionId, out var lastRequest))
        {
            if ((now - lastRequest).TotalSeconds < RATE_LIMIT_SECONDS)
            {
                return false;
            }
        }
        _rateLimitTracker[connectionId] = now;
        return true;
    }
    
    /// <summary>
    /// Validate user has access to the screen (owner or admin)
    /// </summary>
    private async Task<bool> ValidateScreenAccess(string screenId, bool requireOwnership = false)
    {
        var userId = Context.User?.FindFirst("sub")?.Value 
                  ?? Context.User?.FindFirst("id")?.Value
                  ?? Context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        
        // Check if testing mode is enabled (for development)
        var testingMode = _configuration.GetValue<bool>("WebRTC:AllowUnauthenticatedAccess", false);
        if (testingMode)
        {
            _logger.LogWarning("WebRTC testing mode enabled - skipping authentication");
            return true;
        }
        
        if (string.IsNullOrEmpty(userId))
        {
            _logger.LogWarning("No user identity found in StreamingHub context");
            return false;
        }
        
        // Check if user is admin (admins can access all screens)
        var isAdmin = Context.User?.IsInRole("Admin") ?? false;
        if (isAdmin)
        {
            return true;
        }
        
        // Validate screen exists and check ownership
        if (Guid.TryParse(screenId, out var screenGuid))
        {
            var screen = await _screenRepository.GetByIdAsync(screenGuid);
            if (screen == null)
            {
                _logger.LogWarning("Screen {ScreenId} not found", screenId);
                return false;
            }
            
            // For broadcasting, require ownership
            if (requireOwnership)
            {
                var screenOwnerId = screen.OwnerId.ToString();
                if (screenOwnerId != userId)
                {
                    _logger.LogWarning("User {UserId} is not owner of screen {ScreenId}", userId, screenId);
                    return false;
                }
            }
            else
            {
                // For viewing, check if user is owner OR has ScreenOwner/Advertiser role
                var screenOwnerId = screen.OwnerId.ToString();
                var isOwner = screenOwnerId == userId;
                var isScreenOwnerRole = Context.User?.IsInRole("ScreenOwner") ?? false;
                var isAdvertiser = Context.User?.IsInRole("Advertiser") ?? false;
                
                if (!isOwner && !isScreenOwnerRole && !isAdvertiser)
                {
                    _logger.LogWarning("User {UserId} does not have access to view screen {ScreenId}", userId, screenId);
                    return false;
                }
            }
            
            return true;
        }
        
        return false;
    }

    #region HTTP Registration Methods (for Python player)

    /// <summary>
    /// Register stream via HTTP (alternative to SignalR invoke)
    /// </summary>
    public static bool RegisterStreamFromHttp(string screenId, string connectionId)
    {
        // Normalize screenId to lowercase for consistent key matching
        screenId = screenId.ToLowerInvariant();
        var result = _activeStreams.TryAdd(screenId, connectionId);
        
        if (result)
        {
            // Track stream activity for expiry service
            Services.StreamExpiryService.RecordStreamActivity(screenId);
        }
        
        return result;
    }

    /// <summary>
    /// Unregister stream via HTTP
    /// </summary>
    public static void UnregisterStreamFromHttp(string screenId)
    {
        // Normalize screenId to lowercase for consistent key matching
        screenId = screenId.ToLowerInvariant();
        _activeStreams.TryRemove(screenId, out _);
        _streamViewers.TryRemove(screenId, out _);
        
        // Clear stream activity tracking
        Services.StreamExpiryService.ClearStreamActivity(screenId);
    }

    /// <summary>
    /// Check if stream is registered
    /// </summary>
    public static bool IsStreamRegistered(string screenId)
    {
        // Normalize screenId to lowercase for consistent lookup
        screenId = screenId.ToLowerInvariant();
        return _activeStreams.ContainsKey(screenId);
    }
    
    /// <summary>
    /// Get current viewer count for a stream
    /// </summary>
    public static int GetViewerCount(string screenId)
    {
        screenId = screenId.ToLowerInvariant();
        if (_streamViewers.TryGetValue(screenId, out var viewers))
        {
            return viewers.Count;
        }
        return 0;
    }
    
    /// <summary>
    /// Get pending viewers for HTTP polling (for Python player)
    /// </summary>
    public static List<string> GetPendingViewers(string screenId)
    {
        // Normalize screenId to lowercase for consistent lookup
        screenId = screenId.ToLowerInvariant();
        if (_streamViewers.TryGetValue(screenId, out var viewers))
        {
            return viewers.ToList();
        }
        return new List<string>();
    }

    #endregion

    #region Player Methods (Broadcaster)

    /// <summary>
    /// Player registers as a stream broadcaster for their screen
    /// Requires screen ownership or admin role
    /// </summary>
    [Authorize(Policy = "ScreenOwnerOrAdmin")]
    public async Task RegisterStream(string screenId, string streamKey)
    {
        try
        {
            // Rate limiting
            if (!CheckRateLimit(Context.ConnectionId))
            {
                _logger.LogWarning("Rate limit exceeded for connection {ConnectionId}", Context.ConnectionId);
                throw new HubException("Rate limit exceeded. Please wait before trying again.");
            }
            
            // Normalize screenId to lowercase to ensure consistent key matching
            screenId = screenId.ToLowerInvariant();
            
            var userId = Context.User?.FindFirst("sub")?.Value 
                      ?? Context.User?.FindFirst("id")?.Value;

            _logger.LogInformation(
                "Player registering stream. ScreenId: {ScreenId}, ConnectionId: {ConnectionId}, UserId: {UserId}",
                screenId, Context.ConnectionId, userId);

            // Validate screen access with ownership requirement
            var hasAccess = await ValidateScreenAccess(screenId, requireOwnership: true);
            if (!hasAccess)
            {
                _logger.LogWarning("Access denied for user {UserId} to broadcast screen {ScreenId}", userId, screenId);
                throw new HubException("Access denied: You must own this screen to broadcast");
            }

            // Register this connection as the broadcaster for this screen
            _activeStreams[screenId] = Context.ConnectionId;
            _connectionToScreen[Context.ConnectionId] = screenId;

            // Initialize viewer list if needed
            _streamViewers.TryAdd(screenId, new HashSet<string>());

            // Notify any waiting viewers that stream is now available
            await Clients.Group($"screen_{screenId}_viewers")
                .SendAsync("OnStreamAvailable", screenId, streamKey);

            _logger.LogInformation("Stream registered successfully for screen {ScreenId}", screenId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error registering stream for screen {ScreenId}", screenId);
            throw;
        }
    }

    /// <summary>
    /// Player sends WebRTC offer to a specific viewer
    /// </summary>
    public async Task SendOffer(string viewerId, string offerSdp)
    {
        try
        {
            _logger.LogInformation("Sending offer from player to viewer {ViewerId}", viewerId);
            
            // Update viewer's connection state to Connecting
            if (_connectionToScreen.TryGetValue(viewerId, out var screenId))
            {
                UpdateConnectionState(viewerId, screenId, WebRTCState.Connecting);
            }
            
            await Clients.Client(viewerId).SendAsync("OnOffer", offerSdp);
            
            // Send any buffered ICE candidates
            var bufferedCandidates = GetAndClearBufferedCandidates(viewerId);
            foreach (var candidate in bufferedCandidates)
            {
                await Clients.Client(viewerId).SendAsync("OnIceCandidate", candidate);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending offer to viewer {ViewerId}", viewerId);
            
            // Mark connection as failed
            if (_connectionToScreen.TryGetValue(viewerId, out var screenId))
            {
                UpdateConnectionState(viewerId, screenId, WebRTCState.Failed);
            }
            throw;
        }
    }

    /// <summary>
    /// Player sends ICE candidate to a specific viewer
    /// </summary>
    public async Task SendIceCandidate(string viewerId, string candidate)
    {
        try
        {
            // If connection isn't ready yet, buffer the candidate
            if (_connectionStates.TryGetValue(viewerId, out var state) && state.State == WebRTCState.New)
            {
                BufferIceCandidate(viewerId, candidate);
                return;
            }
            
            await Clients.Client(viewerId).SendAsync("OnIceCandidate", candidate);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending ICE candidate to viewer {ViewerId}", viewerId);
        }
    }
    
    /// <summary>
    /// Notify hub that WebRTC connection was established successfully
    /// Called by viewer after ICE negotiation completes
    /// </summary>
    public async Task NotifyConnectionEstablished(string screenId)
    {
        screenId = screenId.ToLowerInvariant();
        var connectionId = Context.ConnectionId;
        
        UpdateConnectionState(connectionId, screenId, WebRTCState.Connected);
        
        _logger.LogInformation("WebRTC connection established for viewer {ViewerId} on screen {ScreenId}",
            connectionId, screenId);
        
        // Notify broadcaster of successful connection
        if (_activeStreams.TryGetValue(screenId, out var playerConnectionId))
        {
            await Clients.Client(playerConnectionId)
                .SendAsync("OnViewerConnectionEstablished", connectionId);
        }
    }
    
    /// <summary>
    /// Notify hub that WebRTC connection failed
    /// Called by viewer when ICE negotiation fails
    /// </summary>
    public async Task NotifyConnectionFailed(string screenId, string reason)
    {
        screenId = screenId.ToLowerInvariant();
        var connectionId = Context.ConnectionId;
        
        UpdateConnectionState(connectionId, screenId, WebRTCState.Failed);
        
        _logger.LogWarning("WebRTC connection failed for viewer {ViewerId} on screen {ScreenId}: {Reason}",
            connectionId, screenId, reason);
        
        // Notify broadcaster of failed connection
        if (_activeStreams.TryGetValue(screenId, out var playerConnectionId))
        {
            await Clients.Client(playerConnectionId)
                .SendAsync("OnViewerConnectionFailed", connectionId, reason);
        }
    }

    #endregion

    #region Viewer Methods

    /// <summary>
    /// Viewer requests to watch a screen's live stream
    /// Requires viewer access (ScreenOwner, Advertiser, or Admin role)
    /// </summary>
    public async Task RequestStream(string screenId)
    {
        try
        {
            // Rate limiting
            if (!CheckRateLimit(Context.ConnectionId))
            {
                _logger.LogWarning("Rate limit exceeded for connection {ConnectionId}", Context.ConnectionId);
                await Clients.Caller.SendAsync("OnStreamError", "Rate limit exceeded. Please wait before trying again.");
                return;
            }
            
            // Normalize screenId to lowercase to ensure consistent key matching
            screenId = screenId.ToLowerInvariant();
            
            var userId = Context.User?.FindFirst("sub")?.Value 
                      ?? Context.User?.FindFirst("id")?.Value;

            _logger.LogInformation(
                "Viewer requesting stream. ScreenId: {ScreenId}, ViewerId: {ViewerId}, UserId: {UserId}",
                screenId, Context.ConnectionId, userId);

            // Validate stream access (viewer access - doesn't require ownership)
            var hasAccess = await ValidateScreenAccess(screenId, requireOwnership: false);
            if (!hasAccess)
            {
                _logger.LogWarning(
                    "Access denied for user {UserId} to view stream for screen {ScreenId}",
                    userId, screenId);
                    
                await Clients.Caller.SendAsync("OnStreamError", "Access denied to this stream");
                return;
            }

            // Check max viewers limit before allowing connection
            var currentViewers = GetViewerCount(screenId);
            var maxViewers = 5; // TODO: Get from screen.MaxViewers in database when available
            
            if (currentViewers >= maxViewers)
            {
                _logger.LogWarning(
                    "Stream at capacity for screen {ScreenId}: {CurrentViewers}/{MaxViewers} viewers",
                    screenId, currentViewers, maxViewers);
                    
                await Clients.Caller.SendAsync("OnStreamError", 
                    $"Stream is at capacity ({maxViewers} viewers). Please try again later.");
                return;
            }

            _logger.LogInformation("Access granted for viewer {UserId} on screen {ScreenId}", userId, screenId);

            // Add viewer to screen's viewer group
            await Groups.AddToGroupAsync(Context.ConnectionId, $"screen_{screenId}_viewers");
            
            // Track viewer
            if (_streamViewers.TryGetValue(screenId, out var viewers))
            {
                viewers.Add(Context.ConnectionId);
            }
            else
            {
                _streamViewers[screenId] = new HashSet<string> { Context.ConnectionId };
            }

            _connectionToScreen[Context.ConnectionId] = screenId;
            
            // Initialize connection state as New
            UpdateConnectionState(Context.ConnectionId, screenId, WebRTCState.New);

            // Check if stream is already active
            if (_activeStreams.TryGetValue(screenId, out var playerConnectionId))
            {
                // Notify player that a new viewer wants to connect
                await Clients.Client(playerConnectionId)
                    .SendAsync("OnViewerConnected", Context.ConnectionId);
                
                _logger.LogInformation(
                    "Notified player {PlayerConnectionId} of new viewer {ViewerId} for screen {ScreenId}",
                    playerConnectionId, Context.ConnectionId, screenId);
            }
            else
            {
                // Stream not active yet, viewer will wait for OnStreamAvailable event
                _logger.LogInformation(
                    "Stream not active for screen {ScreenId}, viewer {ViewerId} will wait",
                    screenId, Context.ConnectionId);
                    
                await Clients.Caller.SendAsync("OnStreamError", 
                    "Waiting for player to start streaming... Make sure the screen player is running and connected.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error requesting stream for screen {ScreenId}", screenId);
            throw;
        }
    }

    /// <summary>
    /// Viewer sends WebRTC answer back to player
    /// </summary>
    public async Task SendAnswer(string screenId, string answerSdp)
    {
        try
        {
            _logger.LogInformation(
                "Viewer {ViewerId} sending answer for screen {ScreenId}",
                Context.ConnectionId, screenId);
                
            // Always store for HTTP polling (fallback path)
            Controllers.StreamingController.StoreAnswerForPlayer(screenId, Context.ConnectionId, answerSdp);
            
            // Also try to send via SignalR directly
            if (_activeStreams.TryGetValue(screenId, out var playerConnectionId))
            {
                _logger.LogInformation(
                    "Also sending answer via SignalR to player {PlayerConnectionId}",
                    playerConnectionId);
                    
                await Clients.Client(playerConnectionId)
                    .SendAsync("OnAnswer", Context.ConnectionId, answerSdp);
            }
            else
            {
                _logger.LogWarning(
                    "No active SignalR connection for screen {ScreenId}, answer stored for HTTP polling only",
                    screenId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending answer for screen {ScreenId}", screenId);
            throw;
        }
    }

    /// <summary>
    /// Viewer sends ICE candidate to player
    /// </summary>
    public async Task SendViewerIceCandidate(string screenId, string candidate)
    {
        try
        {
            // Always store for HTTP polling
            Controllers.StreamingController.StoreViewerIceCandidateForPlayer(screenId, Context.ConnectionId, candidate);
            
            if (_activeStreams.TryGetValue(screenId, out var playerConnectionId))
            {
                await Clients.Client(playerConnectionId)
                    .SendAsync("OnViewerIceCandidate", Context.ConnectionId, candidate);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending viewer ICE candidate for screen {ScreenId}", screenId);
        }
    }

    /// <summary>
    /// Viewer stops watching the stream
    /// </summary>
    public async Task StopWatching(string screenId)
    {
        try
        {
            _logger.LogInformation("Viewer {ViewerId} stopping stream for screen {ScreenId}", 
                Context.ConnectionId, screenId);

            await RemoveViewer(Context.ConnectionId, screenId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error stopping stream for screen {ScreenId}", screenId);
        }
    }

    #endregion

    #region Connection Lifecycle

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        try
        {
            // Clean up rate limit tracking
            _rateLimitTracker.TryRemove(Context.ConnectionId, out _);
            
            // Clean up connection state tracking
            _connectionStates.TryRemove(Context.ConnectionId, out _);
            _iceCandidateBuffer.TryRemove(Context.ConnectionId, out _);
            
            if (_connectionToScreen.TryRemove(Context.ConnectionId, out var screenId))
            {
                // Check if this was a player (broadcaster)
                if (_activeStreams.TryGetValue(screenId, out var playerConnectionId) 
                    && playerConnectionId == Context.ConnectionId)
                {
                    _logger.LogInformation("Stream broadcaster disconnected for screen {ScreenId}", screenId);
                    
                    // Remove active stream
                    _activeStreams.TryRemove(screenId, out _);
                    
                    // Notify all viewers that stream ended
                    await Clients.Group($"screen_{screenId}_viewers")
                        .SendAsync("OnStreamEnded", screenId);
                    
                    // Clean up viewer list
                    _streamViewers.TryRemove(screenId, out _);
                }
                else
                {
                    // This was a viewer
                    await RemoveViewer(Context.ConnectionId, screenId);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling disconnection for connection {ConnectionId}", 
                Context.ConnectionId);
        }

        await base.OnDisconnectedAsync(exception);
    }

    #endregion

    #region Helper Methods

    private async Task RemoveViewer(string viewerConnectionId, string screenId)
    {
        // Remove from viewer list
        if (_streamViewers.TryGetValue(screenId, out var viewers))
        {
            viewers.Remove(viewerConnectionId);
            
            // Notify player when a viewer disconnects so it can cleanup WebRTC resources
            if (_activeStreams.TryGetValue(screenId, out var playerConnectionId))
            {
                // Check if player is using SignalR or HTTP polling
                // HTTP players use a fixed connection ID and won't receive SignalR messages
                if (playerConnectionId != "http-player")
                {
                    _logger.LogInformation(
                        "Viewer {ViewerId} disconnected from screen {ScreenId}, notifying SignalR player",
                        viewerConnectionId, screenId);
                    
                    await Clients.Client(playerConnectionId)
                        .SendAsync("OnViewerDisconnected", viewerConnectionId);
                    
                    // Also notify if this was the last viewer
                    if (viewers.Count == 0)
                    {
                        _logger.LogInformation("Last viewer disconnected from screen {ScreenId}", screenId);
                        await Clients.Client(playerConnectionId)
                            .SendAsync("OnLastViewerDisconnected", screenId);
                    }
                }
                else
                {
                    // HTTP player will detect disconnect on next poll when checking pending viewers
                    _logger.LogInformation(
                        "Viewer {ViewerId} disconnected from screen {ScreenId} (HTTP player - will detect on next poll)",
                        viewerConnectionId, screenId);
                }
            }
        }

        // Remove from group
        await Groups.RemoveFromGroupAsync(viewerConnectionId, $"screen_{screenId}_viewers");
        
        // Clean up connection state
        _connectionStates.TryRemove(viewerConnectionId, out _);
        _iceCandidateBuffer.TryRemove(viewerConnectionId, out _);
        _rateLimitTracker.TryRemove(viewerConnectionId, out _);
    }
    
    /// <summary>
    /// Update connection state for a viewer
    /// </summary>
    private void UpdateConnectionState(string connectionId, string screenId, WebRTCState state)
    {
        _connectionStates.AddOrUpdate(connectionId,
            new ConnectionState 
            { 
                ConnectionId = connectionId, 
                ScreenId = screenId, 
                State = state,
                CreatedAt = DateTime.UtcNow,
                LastActivityAt = DateTime.UtcNow
            },
            (key, existing) =>
            {
                existing.State = state;
                existing.LastActivityAt = DateTime.UtcNow;
                return existing;
            });
    }
    
    /// <summary>
    /// Buffer ICE candidate for a connection (used when connection isn't ready yet)
    /// </summary>
    private void BufferIceCandidate(string connectionId, string candidate)
    {
        _iceCandidateBuffer.AddOrUpdate(connectionId,
            new List<string> { candidate },
            (key, existing) =>
            {
                existing.Add(candidate);
                return existing;
            });
    }
    
    /// <summary>
    /// Get and clear buffered ICE candidates for a connection
    /// </summary>
    private List<string> GetAndClearBufferedCandidates(string connectionId)
    {
        if (_iceCandidateBuffer.TryRemove(connectionId, out var candidates))
        {
            return candidates;
        }
        return new List<string>();
    }
    
    /// <summary>
    /// Clean up timed-out connections (can be called by a background service)
    /// </summary>
    public static List<string> GetTimedOutConnections()
    {
        return _connectionStates
            .Where(kvp => kvp.Value.IsTimedOut && kvp.Value.State != WebRTCState.Connected)
            .Select(kvp => kvp.Key)
            .ToList();
    }
    
    /// <summary>
    /// Get connection statistics for monitoring
    /// </summary>
    public static Dictionary<string, object> GetConnectionStats()
    {
        var stats = new Dictionary<string, object>
        {
            ["ActiveStreams"] = _activeStreams.Count,
            ["TotalViewers"] = _streamViewers.Values.Sum(v => v.Count),
            ["PendingConnections"] = _connectionStates.Count(c => c.Value.State == WebRTCState.Connecting),
            ["ConnectedViewers"] = _connectionStates.Count(c => c.Value.State == WebRTCState.Connected),
            ["FailedConnections"] = _connectionStates.Count(c => c.Value.State == WebRTCState.Failed)
        };
        return stats;
    }

    #endregion
}
