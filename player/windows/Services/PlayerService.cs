using System.Text.Json;
using System.Timers;

namespace PixelSpot.Player.Services;

/// <summary>
/// Core player loop: heartbeat every 30s, manifest sync on change,
/// remote command dispatch.
/// </summary>
public class PlayerService : IDisposable
{
    private readonly ApiClient _api;
    private readonly SecureStorage _storage;
    private readonly PlaylistEngine _playlist;
    private readonly ContentDownloader _downloader;
    private System.Timers.Timer? _heartbeatTimer;
    private bool _syncRequested = false;

    public event Action<string, object?>? OnCommand;
    public event Func<Task>? OnPlaylistUpdated;

    public PlayerService(ApiClient api, SecureStorage storage,
                         PlaylistEngine playlist, ContentDownloader downloader)
    {
        _api = api;
        _storage = storage;
        _playlist = playlist;
        _downloader = downloader;
    }

    public async Task StartAsync(CancellationToken ct)
    {
        // Initial sync
        await SyncManifestAsync(ct);

        // Start heartbeat timer
        _heartbeatTimer = new System.Timers.Timer(30_000);
        _heartbeatTimer.Elapsed += async (_, _) => await HeartbeatAsync(ct);
        _heartbeatTimer.AutoReset = true;
        _heartbeatTimer.Start();
    }

    private async Task HeartbeatAsync(CancellationToken ct)
    {
        try
        {
            var token = _storage.GetDeviceToken();
            var resp = await _api.PostHeartbeatAsync(token, _playlist.CurrentContentId);

            // Execute any pending remote commands
            foreach (var cmd in resp.Commands)
            {
                object? payload = cmd.Payload.HasValue
                    ? ParsePayload(cmd.Payload.Value)
                    : null;
                OnCommand?.Invoke(cmd.Type, payload);
            }

            // Sync manifest if changed or explicitly requested
            if (resp.ManifestChanged || _syncRequested)
            {
                _syncRequested = false;
                var manifest = resp.Manifest ?? await _api.GetManifestAsync(token);
                await _playlist.SyncFromManifestAsync(manifest, ct);
                if (OnPlaylistUpdated != null)
                    await OnPlaylistUpdated.Invoke();
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Log silently — network may be temporarily down
            // Player continues playing cached content
        }
    }

    private async Task SyncManifestAsync(CancellationToken ct)
    {
        try
        {
            var token = _storage.GetDeviceToken();
            var manifest = await _api.GetManifestAsync(token);
            await _playlist.SyncFromManifestAsync(manifest, ct);
        }
        catch
        {
            // If sync fails on startup, play from cache if available
        }
    }

    public void RequestSync() => _syncRequested = true;

    private static object? ParsePayload(JsonElement el) =>
        el.ValueKind switch
        {
            JsonValueKind.Number => el.GetDouble(),
            JsonValueKind.String => el.GetString(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => null,
        };

    public void Dispose()
    {
        _heartbeatTimer?.Stop();
        _heartbeatTimer?.Dispose();
    }
}
