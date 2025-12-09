using Microsoft.AspNetCore.SignalR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using System.Collections.Concurrent;

namespace CCMS.Api.Hubs;

public class PlaybackHub : Hub
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly IUnitOfWork _unitOfWork;
    private static readonly ConcurrentDictionary<string, Guid> _connectionToScreen = new();

    public PlaybackHub(IRepository<Screen> screenRepository, IUnitOfWork unitOfWork)
    {
        _screenRepository = screenRepository;
        _unitOfWork = unitOfWork;
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
    }

    public async Task UnsubscribeFromScreen(string screenId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"screen_{screenId}");
    }

    public async Task SubscribeToCampaign(string campaignId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"campaign_{campaignId}");
    }

    public async Task UnsubscribeFromCampaign(string campaignId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"campaign_{campaignId}");
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
        // Broadcast to screen subscribers
        await Clients.Group($"screen_{eventData.ScreenId}")
            .SendAsync("AdCompleted", eventData);

        // Broadcast to campaign subscribers
        await Clients.Group($"campaign_{eventData.CampaignId}")
            .SendAsync("AdCompleted", eventData);
    }

    public async Task ImpressionUpdate(ImpressionUpdateEvent eventData)
    {
        await Clients.Group($"screen_{eventData.ScreenId}")
            .SendAsync("ImpressionUpdate", eventData);

        await Clients.Group($"campaign_{eventData.CampaignId}")
            .SendAsync("ImpressionUpdate", eventData);
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
