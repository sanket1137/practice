using Microsoft.AspNetCore.SignalR;
using CCMS.Api.Hubs;

namespace CCMS.Api.Services;

/// <summary>
/// Background service to automatically cleanup stale/expired streams
/// Prevents zombie streams from blocking player re-registration
/// </summary>
public class StreamExpiryService : BackgroundService
{
    private readonly ILogger<StreamExpiryService> _logger;
    private readonly IHubContext<StreamingHub> _hubContext;
    private readonly IConfiguration _configuration;
    
    // Track last heartbeat/activity for each stream
    private static readonly Dictionary<string, DateTime> _streamLastActivity = new();
    private static readonly object _activityLock = new();

    public StreamExpiryService(
        ILogger<StreamExpiryService> logger,
        IHubContext<StreamingHub> hubContext,
        IConfiguration configuration)
    {
        _logger = logger;
        _hubContext = hubContext;
        _configuration = configuration;
    }

    /// <summary>
    /// Called when a stream registers - track its activity
    /// </summary>
    public static void RecordStreamActivity(string screenId)
    {
        lock (_activityLock)
        {
            _streamLastActivity[screenId.ToLowerInvariant()] = DateTime.UtcNow;
        }
    }

    /// <summary>
    /// Called when a stream unregisters - remove from tracking
    /// </summary>
    public static void ClearStreamActivity(string screenId)
    {
        lock (_activityLock)
        {
            _streamLastActivity.Remove(screenId.ToLowerInvariant());
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var checkIntervalMinutes = _configuration.GetValue<int>("StreamingSettings:ExpiryCheckIntervalMinutes", 2);
        var timeoutMinutes = _configuration.GetValue<int>("StreamingSettings:StreamTimeoutMinutes", 5);

        _logger.LogInformation(
            "StreamExpiryService started. Check interval: {CheckInterval} min, Timeout: {Timeout} min",
            checkIntervalMinutes, timeoutMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromMinutes(checkIntervalMinutes), stoppingToken);
                await CheckAndExpireStreams(timeoutMinutes);
            }
            catch (OperationCanceledException)
            {
                // Expected when service stops
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in StreamExpiryService");
            }
        }

        _logger.LogInformation("StreamExpiryService stopped");
    }

    private async Task CheckAndExpireStreams(int timeoutMinutes)
    {
        var now = DateTime.UtcNow;
        var expiredStreams = new List<string>();

        lock (_activityLock)
        {
            foreach (var kvp in _streamLastActivity)
            {
                var timeSinceActivity = now - kvp.Value;
                if (timeSinceActivity.TotalMinutes >= timeoutMinutes)
                {
                    expiredStreams.Add(kvp.Key);
                }
            }
        }

        if (expiredStreams.Count > 0)
        {
            _logger.LogWarning(
                "Found {Count} expired streams (inactive for {Timeout}+ minutes)",
                expiredStreams.Count, timeoutMinutes);

            foreach (var screenId in expiredStreams)
            {
                await ExpireStream(screenId);
            }
        }
    }

    private async Task ExpireStream(string screenId)
    {
        try
        {
            _logger.LogInformation("Expiring stale stream for screen {ScreenId}", screenId);

            // Unregister the stream
            StreamingHub.UnregisterStreamFromHttp(screenId);

            // Remove from activity tracking
            ClearStreamActivity(screenId);

            // Notify any viewers that the stream has ended
            await _hubContext.Clients.Group($"screen_{screenId}_viewers")
                .SendAsync("OnStreamEnded", screenId);

            _logger.LogInformation("Successfully expired stream for screen {ScreenId}", screenId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error expiring stream for screen {ScreenId}", screenId);
        }
    }
}
