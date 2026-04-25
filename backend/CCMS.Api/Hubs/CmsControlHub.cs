using System.Security.Claims;
using CCMS.Api.Security;
using CCMS.Application.Interfaces;
using CCMS.Infrastructure.Data;
using CCMS.Shared.DTOs.Cms;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CCMS.Api.Hubs;

/// <summary>
/// Real-time channel for CMS-mode dashboard ↔ player communication.
///
/// Dashboard clients authenticate via JWT (subscribe to a screen group and
/// receive command ACKs + live status). Players authenticate via screen
/// API key (BCrypt-verified) on the <see cref="SubscribePlayer"/> method —
/// they join the same group and receive <c>command</c> events.
///
/// Class-level <c>[Authorize]</c> is intentionally omitted so the hub
/// negotiate endpoint is reachable by both clients; each method enforces
/// its own auth.
/// </summary>
public class CmsControlHub : Hub
{
    private const string PlayerScreenIdKey = "PlayerScreenId";

    private readonly ApplicationDbContext _context;
    private readonly PlayerAuthenticationService _playerAuth;
    private readonly IRemoteCommandService _commandService;
    private readonly ILogger<CmsControlHub> _logger;

    public CmsControlHub(
        ApplicationDbContext context,
        PlayerAuthenticationService playerAuth,
        IRemoteCommandService commandService,
        ILogger<CmsControlHub> logger)
    {
        _context = context;
        _playerAuth = playerAuth;
        _commandService = commandService;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("[CmsControlHub] Client connected ({ConnId}), user={UserId}",
            Context.ConnectionId, Context.UserIdentifier ?? "(anonymous)");
        await base.OnConnectedAsync();
    }

    /// <summary>
    /// Dashboard subscribes to a specific screen's control group. Requires JWT;
    /// caller must own the screen.
    /// </summary>
    public async Task SubscribeScreen(Guid screenId)
    {
        if (!TryGetUserId(out var userId))
        {
            throw new HubException("Authentication required");
        }

        var ownsScreen = await _context.Screens
            .AsNoTracking()
            .AnyAsync(s => s.Id == screenId && s.OwnerId == userId);
        if (!ownsScreen)
        {
            throw new HubException("Screen not found");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(screenId));
        _logger.LogDebug("[CmsControlHub] Dashboard {UserId} joined screen {ScreenId}", userId, screenId);
    }

    public async Task UnsubscribeScreen(Guid screenId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(screenId));
    }

    /// <summary>
    /// Player device subscribes to its screen's command group using its API key.
    /// Uses BCrypt verification against <c>Screen.ApiKeyHash</c>. Once subscribed,
    /// the connection is tagged with the screen id so <see cref="AckCommand"/>
    /// can validate without re-authenticating.
    /// </summary>
    public async Task SubscribePlayer(Guid screenId, string apiKey)
    {
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new HubException("API key required");
        }

        var screen = await _context.Screens
            .AsNoTracking()
            .Where(s => s.Id == screenId)
            .Select(s => new { s.Id, s.ApiKeyHash })
            .FirstOrDefaultAsync();

        if (screen is null || string.IsNullOrEmpty(screen.ApiKeyHash))
        {
            throw new HubException("Screen not found");
        }

        if (!_playerAuth.ValidateApiKey(apiKey, screen.ApiKeyHash))
        {
            _logger.LogWarning("[CmsControlHub] SubscribePlayer auth failed for screen {ScreenId}", screenId);
            throw new HubException("Authentication failed");
        }

        Context.Items[PlayerScreenIdKey] = screenId;
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(screenId));

        // Update online status so the dashboard sees the device as online.
        var liveScreen = await _context.Screens.FirstOrDefaultAsync(s => s.Id == screenId);
        if (liveScreen != null)
        {
            liveScreen.IsOnline = true;
            liveScreen.LastSeenAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        // Notify dashboards in the group that the player is online.
        await Clients.Group(GroupName(screenId)).SendAsync("player_online", new
        {
            screenId,
            at = DateTime.UtcNow
        });

        _logger.LogInformation("[CmsControlHub] Player connected for screen {ScreenId} ({ConnId})",
            screenId, Context.ConnectionId);
    }

    /// <summary>
    /// Player acknowledges a command after executing it. The screen id is
    /// taken from the connection context (set during <see cref="SubscribePlayer"/>)
    /// to prevent cross-screen acks.
    /// </summary>
    public async Task AckCommand(AckCommandRequest request)
    {
        if (!TryGetPlayerScreenId(out var screenId))
        {
            throw new HubException("Player session required");
        }

        await _commandService.AckAsync(screenId, request, Context.ConnectionAborted);

        // Push the updated status to dashboards in the same group.
        await Clients.Group(GroupName(screenId)).SendAsync("command_ack", new
        {
            commandId = request.CommandId,
            success = request.Success,
            errorMessage = request.ErrorMessage,
            at = DateTime.UtcNow
        });

        _logger.LogInformation("[CmsControlHub] Ack from player for command {CmdId} (success={Success})",
            request.CommandId, request.Success);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (TryGetPlayerScreenId(out var screenId))
        {
            var liveScreen = await _context.Screens.FirstOrDefaultAsync(s => s.Id == screenId);
            if (liveScreen != null)
            {
                liveScreen.IsOnline = false;
                liveScreen.LastSeenAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            await Clients.Group(GroupName(screenId)).SendAsync("player_offline", new
            {
                screenId,
                at = DateTime.UtcNow
            });
        }

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>Builds the canonical group name used by both the hub and IssueCommand.</summary>
    public static string GroupName(Guid screenId) => $"cms_screen_{screenId:N}";

    private bool TryGetUserId(out Guid userId)
    {
        userId = Guid.Empty;
        var claim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(claim, out userId);
    }

    private bool TryGetPlayerScreenId(out Guid screenId)
    {
        screenId = Guid.Empty;
        if (Context.Items.TryGetValue(PlayerScreenIdKey, out var val) && val is Guid id)
        {
            screenId = id;
            return true;
        }
        return false;
    }
}
