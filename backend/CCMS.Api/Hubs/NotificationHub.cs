using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace CCMS.Api.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    private readonly ILogger<NotificationHub> _logger;

    public NotificationHub(ILogger<NotificationHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("[NotificationHub] User {UserId} connected (ConnectionId: {ConnectionId})",
            Context.UserIdentifier, Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("[NotificationHub] User {UserId} disconnected", Context.UserIdentifier);
        await base.OnDisconnectedAsync(exception);
    }
}
