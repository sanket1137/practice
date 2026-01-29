using Microsoft.AspNetCore.SignalR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;

namespace CCMS.Api.Hubs;

public class PlaybackHub : Hub
{
    // In-memory cache for impressions waiting to be flushed
    private static readonly ConcurrentBag<Impression> _pendingImpressions = new();
    private static DateTime _lastFlush = DateTime.UtcNow;
    private static readonly object _flushLock = new();
    
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Impression> _impressionRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<PlaybackHub> _logger;
    private readonly IConfiguration _configuration;
    private static readonly ConcurrentDictionary<string, Guid> _connectionToScreen = new();

    public PlaybackHub(
        IRepository<Screen> screenRepository,
        IRepository<Impression> impressionRepository,
        IUnitOfWork unitOfWork,
        ILogger<PlaybackHub> logger,
        IConfiguration configuration)
    {
        _screenRepository = screenRepository;
        _impressionRepository = impressionRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _configuration = configuration;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation($"[PlaybackHub] Client connected: {Context.ConnectionId}");
        await base.OnConnectedAsync();
    }

    /// <summary>
    /// Register a device (Raspberry Pi/Player) with a screen
    /// </summary>
    public async Task RegisterDevice(Guid screenId, string deviceId)
    {
        var screen = await _screenRepository.GetByIdAsync(screenId);
        if (screen == null)
            throw new ArgumentException($"Screen with ID {screenId} not found");

        // Update screen status
        screen.IsOnline = true;
        screen.ConnectedDeviceId = deviceId;
        screen.LastSeenAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync();

        // Track connection
        _connectionToScreen[Context.ConnectionId] = screenId;

        // Join screen group
        await Groups.AddToGroupAsync(Context.ConnectionId, $"screen_{screenId}");

        // Notify clients that screen is now online
        await Clients.All.SendAsync("ScreenStatusChanged", new
        {
            ScreenId = screenId,
            IsOnline = true,
            LastSeenAt = DateTime.UtcNow
        });
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        // Mark screen as offline when device disconnects
        if (_connectionToScreen.TryRemove(Context.ConnectionId, out var screenId))
        {
            var screen = await _screenRepository.GetByIdAsync(screenId);
            if (screen != null)
            {
                screen.IsOnline = false;
                screen.LastSeenAt = DateTime.UtcNow;
                await _unitOfWork.SaveChangesAsync();

                // Notify clients that screen is now offline
                await Clients.All.SendAsync("ScreenStatusChanged", new
                {
                    ScreenId = screenId,
                    IsOnline = false,
                    LastSeenAt = DateTime.UtcNow
                });
            }
        }

        await base.OnDisconnectedAsync(exception);
    }
    
    public async Task SubscribeToScreen(string screenId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"screen_{screenId}");
        _logger.LogInformation($"[PlaybackHub] Client {Context.ConnectionId} subscribed to screen group: screen_{screenId}");
    }

    public async Task UnsubscribeFromScreen(string screenId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"screen_{screenId}");
        _logger.LogInformation($"[PlaybackHub] Client {Context.ConnectionId} unsubscribed from screen: {screenId}");
    }
    public async Task SubscribeToCampaign(string campaignId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"campaign_{campaignId}");
        _logger.LogInformation($"Client {Context.ConnectionId} subscribed to campaign {campaignId}");
    }

    public async Task UnsubscribeFromCampaign(string campaignId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"campaign_{campaignId}");
    }

    /// <summary>
    /// Request player to switch to fast sync mode (1 minute interval)
    /// Called when user opens Live Activity page
    /// </summary>
    public async Task RequestFastSync(string screenId)
    {
        _logger.LogInformation($"⚡ Fast sync requested for screen {screenId} by {Context.ConnectionId}");
        // Notify the player to switch to fast sync mode
        await Clients.Group($"screen_{screenId}").SendAsync("SetSyncMode", "fast");
    }

    /// <summary>
    /// Request player to switch to normal sync mode (10 minute interval)
    /// Called when user leaves Live Activity page
    /// </summary>
    public async Task RequestNormalSync(string screenId)
    {
        _logger.LogInformation($"🐢 Normal sync requested for screen {screenId} by {Context.ConnectionId}");
        // Notify the player to switch to normal sync mode
        await Clients.Group($"screen_{screenId}").SendAsync("SetSyncMode", "normal");
    }

    /// <summary>
    /// Subscribe to booking events for a specific user (screen owner or advertiser)
    /// </summary>
    public async Task SubscribeToBookings(string userId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
        _logger.LogInformation($"Client {Context.ConnectionId} subscribed to booking events for user {userId}");
    }

    public async Task UnsubscribeFromBookings(string userId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{userId}");
    }

    /// <summary>
    /// Broadcast slot status change to all subscribers of a screen
    /// Call this when booking status changes, owner content is added/removed, etc.
    /// </summary>
    public async Task BroadcastSlotStatusChanged(string screenId, SlotStatusChangedEvent eventData)
    {
        await Clients.Group($"screen_{screenId}")
            .SendAsync("SlotStatusChanged", eventData);
        _logger.LogInformation($"Broadcasted SlotStatusChanged for screen {screenId}: {eventData.Action} on slot {eventData.SlotNumber}");
    }

    // Player events
    public async Task AdStarted(AdPlaybackEvent eventData)
    {
        // Broadcast to screen subscribers
        await Clients.Group($"screen_{eventData.ScreenId}")
            .SendAsync("AdStarted", eventData);

        // Broadcast to campaign subscribers
        await Clients.Group($"campaign_{eventData.CampaignId}")
            .SendAsync("AdStarted", eventData);
    }

    public async Task AdCompleted(AdPlaybackEvent eventData)
    {
        try
        {
            // Ensure all DateTime values have Kind=UTC for PostgreSQL
            var playedAtUtc = DateTime.SpecifyKind(eventData.Timestamp, DateTimeKind.Utc);
            var sessionDateUtc = DateTime.SpecifyKind(eventData.Timestamp.Date, DateTimeKind.Utc);
            
            // Store in memory buffer
            var impression = new Impression
            {
                Id = Guid.NewGuid(),
                BookingId = Guid.Parse(eventData.BookingId.ToString()),
                CampaignId = Guid.Parse(eventData.CampaignId.ToString()),
                ScreenId = Guid.Parse(eventData.ScreenId.ToString()),
                CreativeId = Guid.Parse(eventData.CreativeId.ToString()),
                PlayedAt = playedAtUtc,
                SessionDate = sessionDateUtc,
                DeviceId = eventData.DeviceId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            
            _pendingImpressions.Add(impression);
            
            _logger.LogInformation($"[BUFFER] Added impression {impression.Id.ToString().Substring(0, 8)}... Buffer size: {_pendingImpressions.Count}");
            
            // Don't call CheckAndFlush here - let the background timer handle it
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to buffer impression");
        }
        
        // Always broadcast to subscribers (real-time updates)
        await Clients.Group($"screen_{eventData.ScreenId}")
            .SendAsync("AdCompleted", eventData);

        await Clients.Group($"campaign_{eventData.CampaignId}")
            .SendAsync("AdCompleted", eventData);
            
        // Emit screen-level update for campaign analytics
        try
        {
            // Count today's plays for this screen
            var today = DateTime.UtcNow.Date;
            var playsToday = _pendingImpressions
                .Where(i => i.ScreenId == eventData.ScreenId && 
                           i.SessionDate == today)
                .Count();
            
            // Also check database for already-flushed impressions
            var dbPlays = await _impressionRepository
                .FindAsync(i => i.ScreenId == eventData.ScreenId && 
                              i.SessionDate == today);
            
            var totalPlays = playsToday + dbPlays.Count();
            
            await Clients.Group($"campaign_{eventData.CampaignId}")
                .SendAsync("CampaignScreenUpdate", new
                {
                    CampaignId = eventData.CampaignId,
                    ScreenId = eventData.ScreenId,
                    PlayCount = totalPlays,
                    Timestamp = DateTime.UtcNow
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to emit CampaignScreenUpdate event");
        }
    }

    public async Task ImpressionUpdate(ImpressionUpdateEvent eventData)
    {
        await Clients.Group($"screen_{eventData.ScreenId}")
            .SendAsync("ImpressionUpdate", eventData);

        await Clients.Group($"campaign_{eventData.CampaignId}")
            .SendAsync("ImpressionUpdate", eventData);
    }
    
    /// <summary>
    /// Flush impressions to database every minute (configurable)
    /// </summary>
    private async Task CheckAndFlush()
    {
        var flushInterval = _configuration.GetValue<int>("PlaybackSettings:FlushIntervalMinutes", 1);
        var maxBufferSize = _configuration.GetValue<int>("PlaybackSettings:MaxBufferSize", 10000);
        
        var elapsed = DateTime.UtcNow - _lastFlush;
        var shouldFlush = elapsed.TotalMinutes >= flushInterval || 
                          _pendingImpressions.Count >= maxBufferSize;
        
        Console.WriteLine($"[FLUSH CHECK] Elapsed: {elapsed.TotalMinutes:F2} min, Buffer: {_pendingImpressions.Count}, Should flush: {shouldFlush}");
        _logger.LogInformation($"[FLUSH CHECK] Elapsed: {elapsed.TotalMinutes:F2} min, Buffer: {_pendingImpressions.Count}, Should flush: {shouldFlush}");
        
        if (!shouldFlush)
        {
            return;
        }
        
        // Use lock to prevent concurrent flushes
        bool lockAcquired = false;
        try
        {
            lockAcquired = Monitor.TryEnter(_flushLock);
            if (!lockAcquired)
            {
                Console.WriteLine("[FLUSH] Another flush in progress, skipping");
                _logger.LogWarning("[FLUSH] Another flush in progress, skipping");
                return; // Another thread is already flushing
            }
            
            Console.WriteLine("[FLUSH] Lock acquired, starting flush process");
            
            // Take all pending impressions
            var toFlush = new List<Impression>();
            while (_pendingImpressions.TryTake(out var impression))
            {
                toFlush.Add(impression);
            }
            
            if (toFlush.Count == 0)
            {
                Console.WriteLine("[FLUSH] No impressions to flush");
                _logger.LogInformation("[FLUSH] No impressions to flush");
                // Don't return here - let finally block release the lock
            }
            else
            {
                // Batch insert to database
                Console.WriteLine($"[FLUSH] Starting flush of {toFlush.Count} impressions to database...");
                _logger.LogInformation($"[FLUSH] Starting flush of {toFlush.Count} impressions to database...");
                
                foreach (var impression in toFlush)
                {
                    await _impressionRepository.AddAsync(impression);
                }
                
                Console.WriteLine("[FLUSH] All impressions added, saving changes...");
                await _unitOfWork.SaveChangesAsync();
                
                Console.WriteLine($"[FLUSH] ✓ Successfully flushed {toFlush.Count} impressions to database");
                _logger.LogInformation($"[FLUSH] ✓ Successfully flushed {toFlush.Count} impressions to database");
                
                // Update last flush time
                _lastFlush = DateTime.UtcNow;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[FLUSH] ERROR: {ex.Message}");
            Console.WriteLine($"[FLUSH] Stack trace: {ex.StackTrace}");
            _logger.LogError(ex, "[FLUSH] Failed to flush impressions to database");
            // Impressions are lost from memory but player will re-sync in 10 minutes
        }
        finally
        {
            // Only exit the lock if we actually acquired it
            if (lockAcquired)
            {
                Monitor.Exit(_flushLock);
            }
        }
    }
    
    /// <summary>
    /// Get in-memory impression count (not yet in DB)
    /// </summary>
    public static int GetPendingCount(Guid? screenId = null, Guid? campaignId = null)
    {
        var impressions = _pendingImpressions.ToList();
        
        if (screenId.HasValue)
        {
            impressions = impressions.Where(i => i.ScreenId == screenId.Value).ToList();
        }
        
        if (campaignId.HasValue)
        {
            impressions = impressions.Where(i => i.CampaignId == campaignId.Value).ToList();
        }
        
        return impressions.Count;
    }
    
    /// <summary>
    /// Try to take one pending impression from the buffer (for background flush service)
    /// </summary>
    public static bool TryTakePendingImpression(out Impression? impression)
    {
        return _pendingImpressions.TryTake(out impression);
    }
}


public class AdPlaybackEvent
{
    public Guid CreativeId { get; set; }
    public Guid BookingId { get; set; }
    public Guid ScreenId { get; set; }
    public Guid CampaignId { get; set; }
    public DateTime Timestamp { get; set; }
    public string DeviceId { get; set; } = string.Empty;
}

public class ImpressionUpdateEvent
{
    public Guid BookingId { get; set; }
    public Guid ScreenId { get; set; }
    public Guid CampaignId { get; set; }
    public int PlayCount { get; set; }
    public DateTime Timestamp { get; set; }
}

/// <summary>
/// Event broadcast when slot status changes (booking activated, owner content added/removed, etc.)
/// </summary>
public class SlotStatusChangedEvent
{
    public string ScreenId { get; set; } = string.Empty;
    public int SlotNumber { get; set; }
    public string Action { get; set; } = string.Empty; // "BookingActivated", "BookingCompleted", "OwnerContentAdded", "OwnerContentRemoved"
    public string? NewStatus { get; set; } // "Empty", "Custom", "Booked"
    public string? ContentName { get; set; }
    public Guid? BookingId { get; set; }
    public Guid? OwnerContentId { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
