using Microsoft.AspNetCore.SignalR;

namespace CCMS.Api.Hubs;

public class PlaybackHub : Hub
{
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
