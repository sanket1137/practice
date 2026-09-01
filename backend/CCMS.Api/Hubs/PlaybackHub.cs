using Microsoft.AspNetCore.SignalR;
using CCMS.Application.Services;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using System.Collections.Concurrent;
using System.Security.Claims;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;

namespace CCMS.Api.Hubs;

/// <summary>
/// Real-time channel for player playback events and dashboard live updates.
///
/// Class-level auth is intentionally omitted (players have no JWT) so the
/// negotiate endpoint is reachable by both clients; each method enforces its
/// own auth instead:
///  - Player connections authenticate via <see cref="OnConnectedAsync"/> reading
///    ?screenId=&amp;apiKey= from the connection query string (BCrypt-verified
///    against Screen.ApiKeyHash) and are bound to that screen id for the life
///    of the connection.
///  - Dashboard connections authenticate via JWT (already wired for /hubs/* in
///    Program.cs), and are checked against screen/campaign ownership per call.
/// </summary>
public class PlaybackHub : Hub
{
    private const string PlayerScreenIdKey = "PlayerScreenId";

    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Impression> _impressionRepository;
    private readonly IRepository<Campaign> _campaignRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStreamAccessService _streamAccessService;
    private readonly ILogger<PlaybackHub> _logger;
    private static readonly ConcurrentDictionary<string, Guid> _connectionToScreen = new();

    public PlaybackHub(
        IRepository<Screen> screenRepository,
        IRepository<Impression> impressionRepository,
        IRepository<Campaign> campaignRepository,
        IUnitOfWork unitOfWork,
        IStreamAccessService streamAccessService,
        ILogger<PlaybackHub> logger)
    {
        _screenRepository = screenRepository;
        _impressionRepository = impressionRepository;
        _campaignRepository = campaignRepository;
        _unitOfWork = unitOfWork;
        _streamAccessService = streamAccessService;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var httpContext = Context.GetHttpContext();
        var screenIdRaw = httpContext?.Request.Query["screenId"].ToString();
        var apiKey = httpContext?.Request.Query["apiKey"].ToString();

        if (!string.IsNullOrEmpty(screenIdRaw))
        {
            // This connection is presenting player credentials — verify them now,
            // before allowing any hub method to run, rather than trusting
            // whatever screenId a later method call claims to be for.
            if (!Guid.TryParse(screenIdRaw, out var screenId))
            {
                _logger.LogWarning("[PlaybackHub] Rejecting connection: invalid screenId '{ScreenId}'", screenIdRaw);
                Context.Abort();
                return;
            }

            var screen = await _screenRepository.GetByIdAsync(screenId);
            if (screen == null)
            {
                _logger.LogWarning("[PlaybackHub] Rejecting player connection: screen {ScreenId} not found", screenId);
                Context.Abort();
                return;
            }

            if (!string.IsNullOrEmpty(screen.ApiKeyHash))
            {
                if (!CCMS.Api.Security.ScreenApiKeys.Verify(screen, apiKey))
                {
                    _logger.LogWarning("[PlaybackHub] Rejecting player connection: invalid API key for screen {ScreenId}", screenId);
                    Context.Abort();
                    return;
                }
            }
            else
            {
                _logger.LogWarning("[PlaybackHub] Player connection for screen {ScreenId} has no API key configured — allowing but this should be fixed", screenId);
            }

            Context.Items[PlayerScreenIdKey] = screenId;
            _logger.LogInformation("[PlaybackHub] Player authenticated for screen {ScreenId} ({ConnId})", screenId, Context.ConnectionId);
        }

        _logger.LogInformation($"[PlaybackHub] Client connected: {Context.ConnectionId}");
        await base.OnConnectedAsync();
    }

    /// <summary>Screen id this connection authenticated as a player for, if any.</summary>
    private bool IsAuthenticatedPlayerFor(Guid screenId)
    {
        return Context.Items.TryGetValue(PlayerScreenIdKey, out var val) && val is Guid bound && bound == screenId;
    }

    /// <summary>True if the connection is a JWT-authenticated dashboard user who owns (or administers) the screen.</summary>
    private async Task<bool> IsDashboardOwnerOfScreen(Guid screenId)
    {
        if (Context.User?.Identity?.IsAuthenticated != true) return false;
        if (Context.User.IsInRole("Admin")) return true;

        var userIdClaim = Context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId)) return false;

        var screen = await _screenRepository.GetByIdAsync(screenId);
        return screen?.OwnerId == userId;
    }

    /// <summary>
    /// True if the connection is a JWT-authenticated dashboard user allowed to watch
    /// this screen's live activity: the owner/admin, or an advertiser whose booking
    /// grants stream access (active, or approved and starting within the preview
    /// window). Advertisers reach the screen page through "Watch live" on their
    /// campaign — without this, their SubscribeToScreen threw and the Live Activity
    /// panel sat on "Connecting" forever.
    /// </summary>
    private async Task<bool> CanDashboardViewScreen(Guid screenId)
    {
        if (await IsDashboardOwnerOfScreen(screenId)) return true;

        if (Context.User?.Identity?.IsAuthenticated != true) return false;
        var userIdClaim = Context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId)) return false;

        var access = await _streamAccessService.CheckAdvertiserAccessAsync(userId, screenId);
        return access.HasAccess;
    }

    /// <summary>True if the connection is a JWT-authenticated dashboard user who owns (or administers) the campaign.</summary>
    private async Task<bool> IsDashboardOwnerOfCampaign(Guid campaignId)
    {
        if (Context.User?.Identity?.IsAuthenticated != true) return false;
        if (Context.User.IsInRole("Admin")) return true;

        var userIdClaim = Context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId)) return false;

        var campaign = await _campaignRepository.GetByIdAsync(campaignId);
        return campaign?.AdvertiserId == userId;
    }

    /// <summary>
    /// Register a device (Raspberry Pi/Player) with a screen
    /// </summary>
    public async Task RegisterDevice(Guid screenId, string deviceId)
    {
        if (!IsAuthenticatedPlayerFor(screenId))
        {
            _logger.LogWarning("[PlaybackHub] RegisterDevice rejected: connection {ConnId} is not an authenticated player for screen {ScreenId}", Context.ConnectionId, screenId);
            throw new HubException("Player authentication required for this screen. Reconnect with a valid API key.");
        }

        if (string.IsNullOrWhiteSpace(deviceId))
            throw new ArgumentException("deviceId is required", nameof(deviceId));

        var screen = await _screenRepository.GetByIdAsync(screenId);
        if (screen == null)
            throw new ArgumentException($"Screen with ID {screenId} not found");

        // Device-binding check: if screen is already bound to a different device,
        // reject the registration to prevent hub hijacking. A screen is bound when
        // ConnectedDeviceId is non-empty and the device has previously authorized.
        if (!string.IsNullOrEmpty(screen.ConnectedDeviceId) &&
            !string.Equals(screen.ConnectedDeviceId, deviceId, StringComparison.Ordinal))
        {
            _logger.LogWarning(
                "[PlaybackHub] RegisterDevice rejected for screen {ScreenId}: bound to {BoundDevice}, got {IncomingDevice}",
                screenId, screen.ConnectedDeviceId, deviceId);
            throw new HubException("Screen is bound to a different device. Contact support to re-authorize.");
        }

        // Update screen status
        screen.IsOnline = true;
        screen.ConnectedDeviceId = deviceId;
        screen.LastSeenAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync();

        // Track connection
        _connectionToScreen[Context.ConnectionId] = screenId;

        // Join screen group
        await Groups.AddToGroupAsync(Context.ConnectionId, $"screen_{screenId}");

        // Notify clients that screen is now online. Payload shape is the
        // canonical one shared by every ScreenStatusChanged emitter
        // (PlayerController handshake/heartbeat, ScreenStatusMonitor, here):
        // { screenId, isOnline, lastSeen, timestamp } — camelCase on the wire.
        await Clients.All.SendAsync("ScreenStatusChanged", new
        {
            screenId = screenId.ToString(),
            isOnline = true,
            lastSeen = DateTime.UtcNow,
            timestamp = DateTime.UtcNow
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
                    screenId = screenId.ToString(),
                    isOnline = false,
                    lastSeen = DateTime.UtcNow,
                    timestamp = DateTime.UtcNow
                });
            }
        }

        await base.OnDisconnectedAsync(exception);
    }
    
    public async Task SubscribeToScreen(string screenId)
    {
        if (!Guid.TryParse(screenId, out var screenGuid))
            throw new HubException("Invalid screen ID");

        if (!IsAuthenticatedPlayerFor(screenGuid) && !await CanDashboardViewScreen(screenGuid))
        {
            _logger.LogWarning("[PlaybackHub] SubscribeToScreen rejected for {ConnId}: not authorized for screen {ScreenId}", Context.ConnectionId, screenId);
            throw new HubException("Unauthorized: you don't have access to this screen");
        }

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
        if (!Guid.TryParse(campaignId, out var campaignGuid))
            throw new HubException("Invalid campaign ID");

        if (!await IsDashboardOwnerOfCampaign(campaignGuid))
        {
            _logger.LogWarning("[PlaybackHub] SubscribeToCampaign rejected for {ConnId}: not authorized for campaign {CampaignId}", Context.ConnectionId, campaignId);
            throw new HubException("Unauthorized: you don't own this campaign");
        }

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
        if (!Guid.TryParse(screenId, out var screenGuid) || !await CanDashboardViewScreen(screenGuid))
        {
            _logger.LogWarning("[PlaybackHub] RequestFastSync rejected for {ConnId}: not authorized for screen {ScreenId}", Context.ConnectionId, screenId);
            throw new HubException("Unauthorized: you don't have access to this screen");
        }

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
        if (!Guid.TryParse(screenId, out var screenGuid) || !await CanDashboardViewScreen(screenGuid))
        {
            _logger.LogWarning("[PlaybackHub] RequestNormalSync rejected for {ConnId}: not authorized for screen {ScreenId}", Context.ConnectionId, screenId);
            throw new HubException("Unauthorized: you don't have access to this screen");
        }

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
        if (!Guid.TryParse(screenId, out var screenGuid) || (!IsAuthenticatedPlayerFor(screenGuid) && !await IsDashboardOwnerOfScreen(screenGuid)))
        {
            _logger.LogWarning("[PlaybackHub] BroadcastSlotStatusChanged rejected for {ConnId}: not authorized for screen {ScreenId}", Context.ConnectionId, screenId);
            throw new HubException("Unauthorized: you don't have access to this screen");
        }

        await Clients.Group($"screen_{screenId}")
            .SendAsync("SlotStatusChanged", eventData);
        _logger.LogInformation($"Broadcasted SlotStatusChanged for screen {screenId}: {eventData.Action} on slot {eventData.SlotNumber}");
    }

    // ── Player playback events ─────────────────────────────────────────────
    //
    // These are REAL-TIME SIGNALS ONLY. Impression persistence deliberately does
    // not happen here: every player platform (Pi, Android, ChromeOS, Windows)
    // records plays locally and reports them through POST /player/sync, which has
    // SlotPlayKey-based UPSERT deduplication. This hub used to ALSO buffer an
    // impression on every AdCompleted — a second, dedup-less write path that
    // double-counted every booked play (once from here, once from sync). Do not
    // reintroduce persistence here; /player/sync is the single source of truth.

    public async Task AdStarted(AdPlaybackEvent eventData)
    {
        if (!IsAuthenticatedPlayerFor(eventData.ScreenId))
        {
            _logger.LogWarning("[PlaybackHub] AdStarted rejected: connection {ConnId} is not an authenticated player for screen {ScreenId}", Context.ConnectionId, eventData.ScreenId);
            throw new HubException("Player authentication required for this screen.");
        }

        // Broadcast to screen subscribers
        await Clients.Group($"screen_{eventData.ScreenId}")
            .SendAsync("AdStarted", eventData);

        // Broadcast to campaign subscribers — filler/owner-content slots have no
        // campaign, so only booked slots emit into a campaign group.
        if (eventData.CampaignId.HasValue)
        {
            await Clients.Group($"campaign_{eventData.CampaignId}")
                .SendAsync("AdStarted", eventData);
        }
    }

    public async Task AdCompleted(AdPlaybackEvent eventData)
    {
        if (!IsAuthenticatedPlayerFor(eventData.ScreenId))
        {
            _logger.LogWarning("[PlaybackHub] AdCompleted rejected: connection {ConnId} is not an authenticated player for screen {ScreenId}", Context.ConnectionId, eventData.ScreenId);
            throw new HubException("Player authentication required for this screen.");
        }

        // Broadcast to subscribers (real-time updates)
        await Clients.Group($"screen_{eventData.ScreenId}")
            .SendAsync("AdCompleted", eventData);

        if (eventData.CampaignId.HasValue)
        {
            await Clients.Group($"campaign_{eventData.CampaignId}")
                .SendAsync("AdCompleted", eventData);

            // Screen-level rollup for campaign analytics. playCount comes from the
            // database (synced impressions), so it can trail the live event by one
            // sync interval — consumers treat the event itself as the +1 and this
            // count as the authoritative floor.
            try
            {
                var today = DateTime.UtcNow.Date;
                var dbPlays = await _impressionRepository
                    .FindAsync(i => i.ScreenId == eventData.ScreenId &&
                                  i.CampaignId == eventData.CampaignId &&
                                  i.SessionDate == today);

                await Clients.Group($"campaign_{eventData.CampaignId}")
                    .SendAsync("CampaignScreenUpdate", new
                    {
                        CampaignId = eventData.CampaignId,
                        ScreenId = eventData.ScreenId,
                        PlayCount = dbPlays.Count(),
                        Timestamp = DateTime.UtcNow
                    });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to emit CampaignScreenUpdate event");
            }
        }
    }

    public async Task ImpressionUpdate(ImpressionUpdateEvent eventData)
    {
        if (!IsAuthenticatedPlayerFor(eventData.ScreenId))
        {
            _logger.LogWarning("[PlaybackHub] ImpressionUpdate rejected: connection {ConnId} is not an authenticated player for screen {ScreenId}", Context.ConnectionId, eventData.ScreenId);
            throw new HubException("Player authentication required for this screen.");
        }

        await Clients.Group($"screen_{eventData.ScreenId}")
            .SendAsync("ImpressionUpdate", eventData);

        await Clients.Group($"campaign_{eventData.CampaignId}")
            .SendAsync("ImpressionUpdate", eventData);
    }
}


/// <summary>
/// Playback event emitted by players for every slot, booked or not. Booking,
/// campaign, creative and owner-content ids are nullable because filler and
/// owner-content slots genuinely have no booking/campaign — players send null
/// for those. (They previously sent the literal string "None", which failed
/// model binding on the non-nullable Guids this type used to declare and made
/// every filler-slot event throw before reaching any subscriber.)
/// </summary>
public class AdPlaybackEvent
{
    public Guid? CreativeId { get; set; }
    public Guid? BookingId { get; set; }
    public Guid ScreenId { get; set; }
    public Guid? CampaignId { get; set; }
    public Guid? OwnerContentId { get; set; }
    public int SlotNumber { get; set; }
    public bool IsFillerContent { get; set; }
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
