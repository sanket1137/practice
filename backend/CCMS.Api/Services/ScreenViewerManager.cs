using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;

namespace CCMS.Api.Services;

/// <summary>
/// Manages concurrent viewers per screen with owner priority.
/// Screen owners don't count toward the viewer limit.
/// </summary>
public class ScreenViewerManager
{
    private readonly ILogger<ScreenViewerManager> _logger;
    private readonly IConfiguration _configuration;
    
    // Track viewers per screen: screenId -> ViewerInfo dictionary (connectionId -> ViewerInfo)
    private static readonly ConcurrentDictionary<string, ConcurrentDictionary<string, ViewerInfo>> _screenViewers = new();
    
    // Track connection to screen mapping for cleanup
    private static readonly ConcurrentDictionary<string, string> _connectionToScreen = new();
    
    // Default max viewers (configurable)
    public int DefaultMaxViewers { get; }
    
    // Priority levels for viewer eviction
    public const int PRIORITY_OWNER = 100;
    public const int PRIORITY_ADMIN = 90;
    public const int PRIORITY_ADVERTISER_ACTIVE = 50;
    public const int PRIORITY_ADVERTISER_PREVIEW = 30;

    public ScreenViewerManager(ILogger<ScreenViewerManager> logger, IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;
        DefaultMaxViewers = configuration.GetValue<int>("Streaming:MaxViewersPerScreen", 20);
    }

    /// <summary>
    /// Try to add a viewer to a screen. Returns success/failure with reason.
    /// Owner always succeeds and doesn't count toward limit.
    /// </summary>
    public ViewerAddResult TryAddViewer(
        string screenId,
        string connectionId,
        Guid userId,
        ViewerType viewerType,
        bool isOwner,
        Guid? bookingId = null)
    {
        var screenViewers = _screenViewers.GetOrAdd(
            screenId.ToLowerInvariant(), 
            _ => new ConcurrentDictionary<string, ViewerInfo>());

        // Get current non-owner viewer count
        var nonOwnerViewerCount = screenViewers.Values.Count(v => !v.IsOwner);
        
        var viewerInfo = new ViewerInfo
        {
            ConnectionId = connectionId,
            UserId = userId,
            ViewerType = viewerType,
            IsOwner = isOwner,
            BookingId = bookingId,
            Priority = GetPriority(viewerType, isOwner),
            JoinedAt = DateTime.UtcNow
        };

        // Owner always gets in and doesn't count toward limit
        if (isOwner)
        {
            screenViewers[connectionId] = viewerInfo;
            _connectionToScreen[connectionId] = screenId.ToLowerInvariant();
            
            _logger.LogInformation(
                "Owner {UserId} joined screen {ScreenId} (connection: {ConnectionId})",
                userId, screenId, connectionId);

            return new ViewerAddResult
            {
                Success = true,
                Message = "Owner access granted",
                CurrentViewerCount = screenViewers.Count,
                NonOwnerViewerCount = nonOwnerViewerCount
            };
        }

        // Check if we're at capacity for non-owners
        if (nonOwnerViewerCount >= DefaultMaxViewers)
        {
            // Try to evict lowest priority viewer
            var lowestPriorityViewer = screenViewers.Values
                .Where(v => !v.IsOwner)
                .OrderBy(v => v.Priority)
                .ThenBy(v => v.JoinedAt)
                .FirstOrDefault();

            if (lowestPriorityViewer != null && lowestPriorityViewer.Priority < viewerInfo.Priority)
            {
                // Evict the lower priority viewer
                if (screenViewers.TryRemove(lowestPriorityViewer.ConnectionId, out _))
                {
                    _connectionToScreen.TryRemove(lowestPriorityViewer.ConnectionId, out _);
                    
                    _logger.LogInformation(
                        "Evicted viewer {EvictedConnectionId} (priority {EvictedPriority}) " +
                        "to make room for higher priority viewer {NewConnectionId} (priority {NewPriority})",
                        lowestPriorityViewer.ConnectionId, lowestPriorityViewer.Priority,
                        connectionId, viewerInfo.Priority);

                    // Return info about evicted viewer so hub can disconnect them
                    screenViewers[connectionId] = viewerInfo;
                    _connectionToScreen[connectionId] = screenId.ToLowerInvariant();

                    return new ViewerAddResult
                    {
                        Success = true,
                        Message = "Access granted (evicted lower priority viewer)",
                        CurrentViewerCount = screenViewers.Count,
                        NonOwnerViewerCount = screenViewers.Values.Count(v => !v.IsOwner),
                        EvictedConnectionId = lowestPriorityViewer.ConnectionId,
                        EvictedUserId = lowestPriorityViewer.UserId
                    };
                }
            }

            _logger.LogWarning(
                "Screen {ScreenId} at capacity ({Max} viewers). Viewer {UserId} denied access.",
                screenId, DefaultMaxViewers, userId);

            return new ViewerAddResult
            {
                Success = false,
                Message = $"Screen at maximum capacity ({DefaultMaxViewers} viewers)",
                CurrentViewerCount = screenViewers.Count,
                NonOwnerViewerCount = nonOwnerViewerCount
            };
        }

        // Add the viewer
        screenViewers[connectionId] = viewerInfo;
        _connectionToScreen[connectionId] = screenId.ToLowerInvariant();

        _logger.LogInformation(
            "{ViewerType} {UserId} joined screen {ScreenId} (connection: {ConnectionId}, viewers: {Count}/{Max})",
            viewerType, userId, screenId, connectionId, 
            screenViewers.Values.Count(v => !v.IsOwner), DefaultMaxViewers);

        return new ViewerAddResult
        {
            Success = true,
            Message = "Access granted",
            CurrentViewerCount = screenViewers.Count,
            NonOwnerViewerCount = screenViewers.Values.Count(v => !v.IsOwner)
        };
    }

    /// <summary>
    /// Remove a viewer when they disconnect
    /// </summary>
    public void RemoveViewer(string connectionId)
    {
        if (_connectionToScreen.TryRemove(connectionId, out var screenId))
        {
            if (_screenViewers.TryGetValue(screenId, out var viewers))
            {
                if (viewers.TryRemove(connectionId, out var viewerInfo))
                {
                    _logger.LogInformation(
                        "Viewer {UserId} left screen {ScreenId} (connection: {ConnectionId})",
                        viewerInfo.UserId, screenId, connectionId);
                }
            }
        }
    }

    /// <summary>
    /// Remove all viewers for a specific user from a screen
    /// Used when access is revoked
    /// </summary>
    public List<string> RemoveUserFromScreen(Guid userId, string screenId)
    {
        var removedConnections = new List<string>();
        screenId = screenId.ToLowerInvariant();

        if (_screenViewers.TryGetValue(screenId, out var viewers))
        {
            var userConnections = viewers.Values
                .Where(v => v.UserId == userId)
                .Select(v => v.ConnectionId)
                .ToList();

            foreach (var connectionId in userConnections)
            {
                if (viewers.TryRemove(connectionId, out _))
                {
                    _connectionToScreen.TryRemove(connectionId, out _);
                    removedConnections.Add(connectionId);
                }
            }

            if (removedConnections.Any())
            {
                _logger.LogInformation(
                    "Removed {Count} connections for user {UserId} from screen {ScreenId}",
                    removedConnections.Count, userId, screenId);
            }
        }

        return removedConnections;
    }

    /// <summary>
    /// Get current viewer count for a screen
    /// </summary>
    public (int total, int nonOwner) GetViewerCount(string screenId)
    {
        screenId = screenId.ToLowerInvariant();
        if (_screenViewers.TryGetValue(screenId, out var viewers))
        {
            return (viewers.Count, viewers.Values.Count(v => !v.IsOwner));
        }
        return (0, 0);
    }

    /// <summary>
    /// Get all current viewers for a screen
    /// </summary>
    public List<ViewerInfo> GetScreenViewers(string screenId)
    {
        screenId = screenId.ToLowerInvariant();
        if (_screenViewers.TryGetValue(screenId, out var viewers))
        {
            return viewers.Values.ToList();
        }
        return new List<ViewerInfo>();
    }

    /// <summary>
    /// Check if a specific user is viewing a screen
    /// </summary>
    public bool IsUserViewingScreen(Guid userId, string screenId)
    {
        screenId = screenId.ToLowerInvariant();
        if (_screenViewers.TryGetValue(screenId, out var viewers))
        {
            return viewers.Values.Any(v => v.UserId == userId);
        }
        return false;
    }

    private int GetPriority(ViewerType viewerType, bool isOwner)
    {
        if (isOwner) return PRIORITY_OWNER;
        
        return viewerType switch
        {
            ViewerType.Admin => PRIORITY_ADMIN,
            ViewerType.AdvertiserActive => PRIORITY_ADVERTISER_ACTIVE,
            ViewerType.AdvertiserPreview => PRIORITY_ADVERTISER_PREVIEW,
            _ => 0
        };
    }
}

#region DTOs and Enums

public enum ViewerType
{
    Owner,
    Admin,
    AdvertiserActive,
    AdvertiserPreview,
    Unknown
}

public class ViewerInfo
{
    public string ConnectionId { get; set; } = string.Empty;
    public Guid UserId { get; set; }
    public ViewerType ViewerType { get; set; }
    public bool IsOwner { get; set; }
    public Guid? BookingId { get; set; }
    public int Priority { get; set; }
    public DateTime JoinedAt { get; set; }
}

public class ViewerAddResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int CurrentViewerCount { get; set; }
    public int NonOwnerViewerCount { get; set; }
    public string? EvictedConnectionId { get; set; }
    public Guid? EvictedUserId { get; set; }
}

#endregion
