using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using CCMS.Application.Features.Streaming.Queries;
using MediatR;
using System.Collections.Concurrent;

namespace CCMS.Api.Hubs;

/// <summary>
/// SignalR hub for WebRTC signaling between player (broadcaster) and viewers
/// </summary>
// [Authorize] // Temporarily disabled for MVP testing - re-enable for production
public class StreamingHub : Hub
{
    private readonly IMediator _mediator;
    private readonly ILogger<StreamingHub> _logger;
    
    // Track active streams: screenId -> connectionId of player (case-insensitive)
    private static readonly ConcurrentDictionary<string, string> _activeStreams = new(StringComparer.OrdinalIgnoreCase);
    
    // Track viewers: screenId -> list of viewer connectionIds (case-insensitive)
    private static readonly ConcurrentDictionary<string, HashSet<string>> _streamViewers = new(StringComparer.OrdinalIgnoreCase);
    
    // Track connection metadata: connectionId -> screenId (for cleanup)
    private static readonly ConcurrentDictionary<string, string> _connectionToScreen = new();

    public StreamingHub(IMediator mediator, ILogger<StreamingHub> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    #region HTTP Registration Methods (for Python player)

    /// <summary>
    /// Register stream via HTTP (alternative to SignalR invoke)
    /// </summary>
    public static bool RegisterStreamFromHttp(string screenId, string connectionId)
    {
        // Normalize screenId to lowercase for consistent key matching
        screenId = screenId.ToLowerInvariant();
        return _activeStreams.TryAdd(screenId, connectionId);
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
    }

    /// <summary>
    /// Check if stream is registered
    /// </summary>
    public static bool IsStreamRegistered(string screenId)
    {
        return _activeStreams.ContainsKey(screenId);
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
    /// </summary>
    public async Task RegisterStream(string screenId, string streamKey)
    {
        try
        {
            // Normalize screenId to lowercase to ensure consistent key matching
            screenId = screenId.ToLowerInvariant();
            
            // Validate stream key (basic security - should match player's auth)
            var userId = Context.User?.FindFirst("sub")?.Value 
                      ?? Context.User?.FindFirst("id")?.Value;

            _logger.LogInformation(
                "Player registering stream. ScreenId: {ScreenId}, ConnectionId: {ConnectionId}, UserId: {UserId}",
                screenId, Context.ConnectionId, userId);

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
            
            await Clients.Client(viewerId).SendAsync("OnOffer", offerSdp);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending offer to viewer {ViewerId}", viewerId);
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
            await Clients.Client(viewerId).SendAsync("OnIceCandidate", candidate);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending ICE candidate to viewer {ViewerId}", viewerId);
        }
    }

    #endregion

    #region Viewer Methods

    /// <summary>
    /// Viewer requests to watch a screen's live stream
    /// </summary>
    public async Task RequestStream(string screenId)
    {
        try
        {
            // Normalize screenId to lowercase to ensure consistent key matching
            screenId = screenId.ToLowerInvariant();
            
            var userId = Context.User?.FindFirst("sub")?.Value 
                      ?? Context.User?.FindFirst("id")?.Value;

            _logger.LogInformation(
                "Viewer requesting stream. ScreenId: {ScreenId}, ViewerId: {ViewerId}, UserId: {UserId}",
                screenId, Context.ConnectionId, userId);

            // Temporarily disabled for MVP testing - allow all viewers
            // TODO: Re-enable authorization for production
            /*
            // Check if user has permission to view this stream
            var hasAccess = await _mediator.Send(new GetStreamAccessQuery 
            { 
                ScreenId = screenId, 
                UserId = userId ?? string.Empty 
            });

            if (!hasAccess)
            {
                _logger.LogWarning(
                    "Access denied for user {UserId} to view stream for screen {ScreenId}",
                    userId, screenId);
                    
                await Clients.Caller.SendAsync("OnStreamError", "Access denied to this stream");
                return;
            }
            */

            _logger.LogInformation("Access granted for testing - authorization disabled");

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
                    
                await Clients.Caller.SendAsync("OnStreamError", "Stream is not currently active");
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
            // Normalize screenId to lowercase for consistent key matching
            screenId = screenId.ToLowerInvariant();
            
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
        _logger.LogInformation("RemoveViewer called for viewer {ViewerId} on screen {ScreenId}", 
            viewerConnectionId, screenId);
        
        // Remove from viewer list
        if (_streamViewers.TryGetValue(screenId, out var viewers))
        {
            var removed = viewers.Remove(viewerConnectionId);
            _logger.LogInformation("Removed viewer from _streamViewers: {Removed}. Remaining viewers: {Count}", 
                removed, viewers.Count);
            
            // If no more viewers, potentially notify player to stop streaming
            if (viewers.Count == 0 && _activeStreams.TryGetValue(screenId, out var playerConnectionId))
            {
                _logger.LogInformation("Last viewer disconnected from screen {ScreenId}, notifying player", screenId);
                await Clients.Client(playerConnectionId).SendAsync("OnLastViewerDisconnected", screenId);
            }
        }
        else
        {
            _logger.LogWarning("No viewer list found for screen {ScreenId}", screenId);
        }

        // Remove from group
        await Groups.RemoveFromGroupAsync(viewerConnectionId, $"screen_{screenId}_viewers");
    }

    /// <summary>
    /// Get current viewer count for a screen (optional utility method)
    /// </summary>
    public int GetViewerCount(string screenId)
    {
        if (_streamViewers.TryGetValue(screenId, out var viewers))
        {
            return viewers.Count;
        }
        return 0;
    }

    #endregion
}
