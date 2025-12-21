using Microsoft.AspNetCore.SignalR;
using CCMS.Infrastructure.Data;
using CCMS.Application.Services;
using CCMS.Domain.Entities;
using CCMS.Shared.DTOs.Player;
using CCMS.Shared.Enums;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CCMS.Api.Hubs;

public class PlayerHub : Hub
{
    private readonly ILogger<PlayerHub> _logger;
    private readonly ApplicationDbContext _context;
    private readonly PlaylistGeneratorService _playlistService;
    
    public PlayerHub(
        ILogger<PlayerHub> logger, 
        ApplicationDbContext context,
        PlaylistGeneratorService playlistService)
    {
        _logger = logger;
        _context = context;
        _playlistService = playlistService;
    }

    // ─────── CONNECTION MANAGEMENT ───────
    
    public override async Task OnConnectedAsync()
    {
        var clientType = Context.GetHttpContext()?.Request.Query["clientType"].ToString();
        var connectionId = Context.ConnectionId;
        
        if (clientType == "player")
        {
            Context.Items["ClientType"] = ClientType.Player;
            _logger.LogInformation($"Player connected: {connectionId}");
        }
        else if (clientType == "dashboard")
        {
            // Verify dashboard user is authenticated
            if (Context.User?.Identity?.IsAuthenticated != true)
            {
                _logger.LogWarning($"Unauthenticated dashboard user attempted connection: {connectionId}");
                Context.Abort();
                return;
            }
            
            var userId = Context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                _logger.LogWarning($"Dashboard connection missing userId claim: {connectionId}");
                Context.Abort();
                return;
            }
            
            Context.Items["ClientType"] = ClientType.Dashboard;
            Context.Items["UserId"] = userId;
            _logger.LogInformation($"Dashboard user {userId} connected: {connectionId}");
        }
        else
        {
            _logger.LogWarning($"Unknown client type attempted connection: {connectionId}");
            Context.Abort();
            return;
        }
        
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var connectionId = Context.ConnectionId;
        _logger.LogInformation($"Client disconnected: {connectionId}");
        
        if (exception != null)
        {
            _logger.LogError(exception, $"Client disconnected with error: {connectionId}");
        }
        
        await base.OnDisconnectedAsync(exception);
    }
    
    // ─────── AUTHORIZATION HELPERS ───────
    
    private bool IsPlayer()
    {
        return Context.Items.TryGetValue("ClientType", out var type) && 
               (ClientType)type! == ClientType.Player;
    }
    
    private bool IsDashboard()
    {
        return Context.Items.TryGetValue("ClientType", out var type) && 
               (ClientType)type! == ClientType.Dashboard;
    }
    
    private async Task<bool> CanAccessScreen(Guid screenId)
    {
        if (!IsDashboard()) return false;
        
        var userId = Context.Items["UserId"]?.ToString();
        if (string.IsNullOrEmpty(userId)) return false;
        
        var userGuid = Guid.Parse(userId);
        var screen = await _context.Screens.FindAsync(screenId);
        
        // Admin or screen owner
        return Context.User.IsInRole("Admin") || screen?.OwnerId == userGuid;
    }
    
    // ─────── PLAYER METHODS (Once per day + periodic sync) ───────
    
    /// <summary>
    /// Player handshake - called once when player starts for the day
    /// </summary>
    [HubMethodName("Handshake")]
    public async Task<HandshakeResponse> Handshake(string screenId, string apiKey, string playerVersion)
    {
        if (!IsPlayer())
        {
            return new HandshakeResponse
            {
                Success = false,
                Message = "Unauthorized: Only players can handshake"
            };
        }
        
        try
        {
            _logger.LogInformation($"Handshake attempt for screen: {screenId}, version: {playerVersion}");
            
            if (!Guid.TryParse(screenId, out var screenGuid))
            {
                return new HandshakeResponse { Success = false, Message = "Invalid screen ID" };
            }
            
            var screen = await _context.Screens
                .FirstOrDefaultAsync(s => s.Id == screenGuid && !s.IsDeleted);
            
            if (screen == null)
            {
                _logger.LogWarning($"Handshake failed: Screen not found {screenId}");
                return new HandshakeResponse { Success = false, Message = "Screen not found" };
            }
            
            // TODO: Implement BCrypt verification when API keys are generated
            if (string.IsNullOrEmpty(screen.ApiKeyHash))
            {
                _logger.LogWarning($"Screen {screenId} has no API key configured");
            }
            
            // Update screen status
            screen.LastSeenAt = DateTime.UtcNow;
            screen.IsOnline = true;
            await _context.SaveChangesAsync();
            
            // Get today's playlist
            var playlist = await _playlistService.GeneratePlaylistAsync(screenGuid, DateTime.Today);
            
            _logger.LogInformation($"Handshake successful for screen {screenId}");
            
            return new HandshakeResponse
            {
                Success = true,
                ServerTime = DateTime.UtcNow,
                Playlist = playlist,
                SyncIntervalMinutes = 10, // Tell player to sync every 10 minutes
                Message = "Handshake successful"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Handshake error for screen {screenId}");
            return new HandshakeResponse { Success = false, Message = "Handshake failed" };
        }
    }
    
    /// <summary>
    /// Player syncs accumulated data every 10 minutes
    /// </summary>
    [HubMethodName("SyncDailyData")]
    public async Task<SyncResponse> SyncDailyData(string screenId, DailySyncData syncData)
    {
        if (!IsPlayer())
        {
            return new SyncResponse { Success = false, Message = "Unauthorized: Only players can sync data" };
        }
        
        try
        {
            if (!Guid.TryParse(screenId, out var screenGuid))
            {
                return new SyncResponse { Success = false, Message = "Invalid screen ID" };
            }
            
            var totalImpressions = syncData.CampaignImpressions.Sum(c => c.PlayTimestamps.Count);
            _logger.LogInformation($"Syncing data for screen {screenId}: {totalImpressions} impressions");
            
            // Save impressions to database
            int savedCount = 0;
            foreach (var campaign in syncData.CampaignImpressions)
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
                        PlayTimestamp = timestamp,
                        SessionDate = timestamp.Date,
                        DeviceId = screenId,
                        CreatedAt = DateTime.UtcNow
                    };
                    
                    _context.Impressions.Add(impression);
                    savedCount++;
                }
            }
            
            // Update screen stats
            var screen = await _context.Screens.FindAsync(screenGuid);
            if (screen != null)
            {
                screen.LastSeenAt = DateTime.UtcNow;
                screen.IsOnline = true;
            }
            
            await _context.SaveChangesAsync();
            
            // Broadcast to subscribed dashboards
            await Clients.Group($"screen-{screenId}").SendAsync("OnPlayerSync", new
            {
                screenId,
                uptime = syncData.Uptime,
                impressionCount = totalImpressions,
                timestamp = DateTime.UtcNow
            });
            
            _logger.LogInformation($"Sync successful for screen {screenId}: {savedCount} impressions saved");
            
            return new SyncResponse
            {
                Success = true,
                Message = "Sync successful",
                ImpressionsSaved = savedCount
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Sync failed for screen {screenId}");
            return new SyncResponse { Success = false, Message = $"Sync failed: {ex.Message}" };
        }
    }
    
    // ─────── DASHBOARD METHODS (Real-time monitoring) ───────
    
    /// <summary>
    /// Dashboard subscribes to screen updates
    /// </summary>
    [HubMethodName("SubscribeToScreen")]
    public async Task SubscribeToScreen(string screenId)
    {
        if (!IsDashboard())
        {
            throw new HubException("Unauthorized: Only dashboards can subscribe");
        }
        
        if (!Guid.TryParse(screenId, out var screenGuid))
        {
            throw new HubException("Invalid screen ID");
        }
        
        if (!await CanAccessScreen(screenGuid))
        {
            throw new HubException("Unauthorized: You don't own this screen");
        }
        
        await Groups.AddToGroupAsync(Context.ConnectionId, $"screen-{screenId}");
        _logger.LogInformation($"Dashboard subscribed to screen {screenId}");
        
        // Send current screen status immediately
        var screen = await _context.Screens.FindAsync(screenGuid);
        await Clients.Caller.SendAsync("OnScreenStatus", new
        {
            screenId,
            isOnline = screen?.IsOnline ?? false,
            lastSeen = screen?.LastSeenAt
        });
    }
    
    [HubMethodName("UnsubscribeFromScreen")]
    public async Task UnsubscribeFromScreen(string screenId)
    {
        if (!IsDashboard()) return;
        
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"screen-{screenId}");
        _logger.LogInformation($"Dashboard unsubscribed from screen {screenId}");
    }
    
    [HubMethodName("SubscribeToCampaign")]
    public async Task SubscribeToCampaign(string campaignId)
    {
        if (!IsDashboard())
        {
            throw new HubException("Unauthorized: Only dashboards can subscribe");
        }
        
        // TODO: Check if user owns this campaign
        
        await Groups.AddToGroupAsync(Context.ConnectionId, $"campaign-{campaignId}");
        _logger.LogInformation($"Dashboard subscribed to campaign {campaignId}");
    }
    
    [HubMethodName("UnsubscribeFromCampaign")]
    public async Task UnsubscribeFromCampaign(string campaignId)
    {
        if (!IsDashboard()) return;
        
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"campaign-{campaignId}");
        _logger.LogInformation($"Dashboard unsubscribed from campaign {campaignId}");
    }
}
