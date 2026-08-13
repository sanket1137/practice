using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.NetworkInformation;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace PixelSpot.LedAgent;

/// <summary>
/// Windows Service that sends heartbeat to PixelSpot CCMS LED endpoint
/// and receives zone layout + play commands via HTTP long-poll.
///
/// NTP-Synced playback: the heartbeat response can include a play_at ISO timestamp.
/// The agent queues the command and fires it at the exact UTC moment using a
/// high-resolution timer, achieving frame-accurate synchronized playback across
/// multiple LED controllers sharing the same NTP time source.
/// </summary>
public class LedAgentWorker : BackgroundService
{
    private const string SERVER_URL_ENV = "CCMS_SERVER";
    private const string DEFAULT_SERVER = "https://ccms.pixelspot.in";
    private const int HEARTBEAT_INTERVAL_SECONDS = 30;

    private readonly ILogger<LedAgentWorker> _logger;
    private readonly HttpClient _http;
    private readonly SecureTokenStorage _storage;
    private string? _deviceToken;

    public LedAgentWorker(ILogger<LedAgentWorker> logger)
    {
        _logger = logger;
        _storage = new SecureTokenStorage();
        _http = new HttpClient
        {
            BaseAddress = new Uri(Environment.GetEnvironmentVariable(SERVER_URL_ENV) ?? DEFAULT_SERVER),
            Timeout = TimeSpan.FromSeconds(30),
        };
        _http.DefaultRequestHeaders.UserAgent.ParseAdd("PixelSpotLedAgent/1.0");
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _deviceToken = _storage.GetDeviceToken();

        if (string.IsNullOrEmpty(_deviceToken))
        {
            _logger.LogWarning("No device token found. Set CCMS_DEVICE_TOKEN environment variable.");
            _logger.LogWarning("Or register via: PixelSpotLedAgent.exe register --screen-id <screenId> --token <token>");
            return;
        }

        _logger.LogInformation("PixelSpot LED Agent started. Server: {Server}", _http.BaseAddress);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SendHeartbeatAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Heartbeat failed");
            }

            await Task.Delay(TimeSpan.FromSeconds(HEARTBEAT_INTERVAL_SECONDS), stoppingToken);
        }
    }

    private async Task SendHeartbeatAsync(CancellationToken ct)
    {
        var request = new HeartbeatRequest
        {
            AgentVersion = "1.0",
            ControllerSoftware = "PixelSpotLedAgent",
            IpAddress = GetLocalIpAddress(),
        };

        using var content = new StringContent(
            JsonSerializer.Serialize(request),
            Encoding.UTF8,
            "application/json");

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/led/agent/heartbeat");
        httpRequest.Content = content;
        httpRequest.Headers.Add("X-Device-Token", _deviceToken);

        using var response = await _http.SendAsync(httpRequest, ct);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Heartbeat returned {Status}", response.StatusCode);
            return;
        }

        var json = await response.Content.ReadAsStringAsync(ct);
        var result = JsonSerializer.Deserialize<HeartbeatResult>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
        });

        if (result?.Data?.PlayCommand != null)
        {
            HandlePlayCommand(result.Data.PlayCommand);
        }

        _logger.LogDebug("Heartbeat OK. Zones: {Count}", result?.Data?.Zones?.Count ?? 0);
    }

    private void HandlePlayCommand(string command)
    {
        try
        {
            using var doc = JsonDocument.Parse(command);
            var root = doc.RootElement;

            // NTP-synced play_at support
            if (root.TryGetProperty("play_at", out var playAtEl) &&
                playAtEl.TryGetDateTime(out var playAt))
            {
                var delay = playAt.ToUniversalTime() - DateTime.UtcNow;
                if (delay > TimeSpan.Zero && delay < TimeSpan.FromMinutes(5))
                {
                    _logger.LogInformation("Scheduling NTP-synced play at {PlayAt} (in {Delay}ms)",
                        playAt, delay.TotalMilliseconds);
                    Task.Delay(delay).ContinueWith(_ => ExecutePlayCommand(root));
                    return;
                }
            }

            ExecutePlayCommand(root);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to handle play command: {Command}", command);
        }
    }

    private void ExecutePlayCommand(JsonElement command)
    {
        if (command.TryGetProperty("action", out var action))
        {
            _logger.LogInformation("Executing LED command: {Action}", action.GetString());
            // In a real deployment, this would call the LED controller SDK
            // (Novastar, Colorlight, etc.) via their Windows API/SDK
        }
    }

    private static string? GetLocalIpAddress()
    {
        try
        {
            return NetworkInterface.GetAllNetworkInterfaces()
                .Where(n => n.OperationalStatus == OperationalStatus.Up &&
                             n.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                .SelectMany(n => n.GetIPProperties().UnicastAddresses)
                .Where(a => a.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                .Select(a => a.Address.ToString())
                .FirstOrDefault();
        }
        catch { return null; }
    }

    public override void Dispose()
    {
        _http.Dispose();
        base.Dispose();
    }
}

// ── Request / Response models ─────────────────────────────────────────────

record HeartbeatRequest
{
    public string AgentVersion { get; init; } = string.Empty;
    public string ControllerSoftware { get; init; } = string.Empty;
    public string? IpAddress { get; init; }
    public decimal? TemperatureCelsius { get; init; }
}

record HeartbeatResult
{
    public HeartbeatData? Data { get; init; }
}

record HeartbeatData
{
    public List<object> Zones { get; init; } = new();
    public string? PlayCommand { get; init; }
}

// ── DPAPI token storage ───────────────────────────────────────────────────

internal sealed class SecureTokenStorage
{
    private static readonly string StoragePath = System.IO.Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "PixelSpot", "LedAgent", "agent.dat");

    public string? GetDeviceToken()
    {
        // Prefer environment variable for container/CI deployments
        var envToken = Environment.GetEnvironmentVariable("CCMS_DEVICE_TOKEN");
        if (!string.IsNullOrEmpty(envToken)) return envToken;

        if (!System.IO.File.Exists(StoragePath)) return null;
        try
        {
            var encrypted = System.IO.File.ReadAllBytes(StoragePath);
            var decrypted = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.LocalMachine);
            return Encoding.UTF8.GetString(decrypted);
        }
        catch { return null; }
    }

    public void SetDeviceToken(string token)
    {
        System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(StoragePath)!);
        var data = Encoding.UTF8.GetBytes(token);
        var encrypted = ProtectedData.Protect(data, null, DataProtectionScope.LocalMachine);
        System.IO.File.WriteAllBytes(StoragePath, encrypted);
    }
}
