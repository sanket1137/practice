using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

namespace PixelSpot.Player.Services;

public record PairingCodeResult(string Code, string? QrCodeUrl);
public record PairingStatusResult(bool IsApproved, string? DeviceToken, string? ScreenId);
public record ClaimResult(string DeviceToken, string ScreenId);

public record HeartbeatResponse(
    bool ManifestChanged,
    List<RemoteCommand> Commands,
    ManifestItem[]? Manifest
);

public record RemoteCommand(string Type, JsonElement? Payload);
public record ManifestItem(string ContentId, string Url, string ContentType, int DurationSeconds, int Order);

/// <summary>
/// HTTP client for all CCMS API calls.
/// Base URL is read from environment variable CCMS_SERVER (default: https://ccms.pixelspot.in).
/// </summary>
public class ApiClient
{
    private readonly HttpClient _http;
    private readonly string _baseUrl;
    private static readonly string AppVersion = "1.0.0-windows";

    public ApiClient()
    {
        _baseUrl = Environment.GetEnvironmentVariable("CCMS_SERVER") ?? "https://ccms.pixelspot.in";
        _http = new HttpClient { BaseAddress = new Uri(_baseUrl.TrimEnd('/') + "/api/v1/") };
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    // ── Pairing ──────────────────────────────────────────────────────────────

    public async Task<PairingCodeResult> RequestPairingCodeAsync()
    {
        var body = JsonSerializer.Serialize(new
        {
            deviceFingerprint = DeviceFingerprint(),
            deviceModel = $"Windows/{RuntimeInformation.OSArchitecture}",
            osVersion = RuntimeInformation.OSDescription,
            appVersion = AppVersion,
        });
        using var req = new StringContent(body, Encoding.UTF8, "application/json");
        using var resp = await _http.PostAsync("cms/pairing/request", req);
        resp.EnsureSuccessStatusCode();

        var json = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var data = doc.RootElement.TryGetProperty("data", out var d) ? d : doc.RootElement;
        var code = data.GetProperty("pairingCode").GetString()!;
        var qr = data.TryGetProperty("qrCodeUrl", out var qrEl) ? qrEl.GetString() : null;
        return new PairingCodeResult(code, qr);
    }

    public async Task<PairingStatusResult> GetPairingStatusAsync(string pairingCode)
    {
        using var resp = await _http.GetAsync($"cms/pairing/status/{pairingCode}");
        resp.EnsureSuccessStatusCode();

        var json = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var data = doc.RootElement.TryGetProperty("data", out var d) ? d : doc.RootElement;
        var approved = data.TryGetProperty("approved", out var a) && a.GetBoolean();
        var token = data.TryGetProperty("deviceToken", out var t) ? t.GetString() : null;
        var screenId = data.TryGetProperty("screenId", out var s) ? s.GetString() : null;
        return new PairingStatusResult(approved, token, screenId);
    }

    public async Task<ClaimResult> ClaimPairingCodeAsync(string code)
    {
        var body = JsonSerializer.Serialize(new
        {
            code,
            deviceFingerprint = DeviceFingerprint(),
            deviceModel = $"Windows/{RuntimeInformation.OSArchitecture}",
            osVersion = RuntimeInformation.OSDescription,
            appVersion = AppVersion,
        });
        using var req = new StringContent(body, Encoding.UTF8, "application/json");
        using var resp = await _http.PostAsync("cms/pairing/claim", req);

        if (!resp.IsSuccessStatusCode)
        {
            var err = await resp.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Pairing failed ({(int)resp.StatusCode}): {err}");
        }

        var json = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var data = doc.RootElement.TryGetProperty("data", out var d) ? d : doc.RootElement;
        return new ClaimResult(
            data.GetProperty("deviceToken").GetString()!,
            data.GetProperty("screenId").GetString()!
        );
    }

    // ── Heartbeat ─────────────────────────────────────────────────────────────

    public async Task<HeartbeatResponse> PostHeartbeatAsync(string deviceToken, string? playingContentId)
    {
        _http.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", deviceToken);

        var body = JsonSerializer.Serialize(new
        {
            playingContentId,
            playerVersion = AppVersion,
            platform = "windows",
        });
        using var req = new StringContent(body, Encoding.UTF8, "application/json");
        using var resp = await _http.PostAsync("player/heartbeat", req);
        resp.EnsureSuccessStatusCode();

        var json = await resp.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<HeartbeatResponse>(json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
               ?? new HeartbeatResponse(false, [], null);
    }

    public async Task<ManifestItem[]> GetManifestAsync(string deviceToken)
    {
        _http.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", deviceToken);

        using var resp = await _http.GetAsync("player/manifest");
        resp.EnsureSuccessStatusCode();

        var json = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var data = doc.RootElement.TryGetProperty("data", out var d) ? d : doc.RootElement;
        return data.Deserialize<ManifestItem[]>(new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
               ?? [];
    }

    private static string DeviceFingerprint()
    {
        try
        {
            var mac = NetworkInterface.GetAllNetworkInterfaces()
                .FirstOrDefault(n => n.OperationalStatus == OperationalStatus.Up)
                ?.GetPhysicalAddress().ToString() ?? "unknown";
            return $"{Environment.MachineName}-{mac}";
        }
        catch
        {
            return Guid.NewGuid().ToString();
        }
    }
}
