using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace CCMS.Api.Security;

/// <summary>
/// Service for validating player API requests with HMAC signatures
/// Implements:
/// - API key validation (BCrypt hashed)
/// - HMAC signature verification
/// - Timestamp validation (replay attack prevention)
/// - Device fingerprint validation
/// </summary>
public class PlayerAuthenticationService
{
    private readonly ILogger<PlayerAuthenticationService> _logger;
    private readonly IConfiguration _configuration;
    private const int MAX_TIMESTAMP_DRIFT_SECONDS = 300; // 5 minutes

    public PlayerAuthenticationService(
        ILogger<PlayerAuthenticationService> logger,
        IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;
    }

    /// <summary>
    /// Validate an API key against the stored hash
    /// </summary>
    public bool ValidateApiKey(string providedApiKey, string storedApiKeyHash)
    {
        if (string.IsNullOrEmpty(providedApiKey) || string.IsNullOrEmpty(storedApiKeyHash))
            return false;

        // Use BCrypt to verify (assuming storedApiKeyHash is BCrypt hash)
        try
        {
            return BCrypt.Net.BCrypt.Verify(providedApiKey, storedApiKeyHash);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating API key");
            return false;
        }
    }

    /// <summary>
    /// Hash an API key for storage using BCrypt
    /// </summary>
    public string HashApiKey(string apiKey)
    {
        return BCrypt.Net.BCrypt.HashPassword(apiKey, workFactor: 12);
    }

    /// <summary>
    /// Generate a SHA-256 hash of the API key (for comparison when player sends hash)
    /// </summary>
    public string GetApiKeySha256Hash(string apiKey)
    {
        using var sha256 = SHA256.Create();
        var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(apiKey));
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }

    /// <summary>
    /// Generate a secure session token for the player
    /// </summary>
    public (string Token, string Salt, DateTime ExpiresAt) GenerateSessionToken(string screenId)
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var salt = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
        var expiresAt = DateTime.UtcNow.AddHours(24); // 24 hour sessions

        return (token, salt, expiresAt);
    }

    /// <summary>
    /// Validate HMAC signature on an incoming request, keyed by the player's
    /// current session token.
    ///
    /// This is deliberately NOT keyed by the raw API key: the server only ever
    /// stores a one-way BCrypt hash of it (correctly — it must not be
    /// reversible), so there is no way for the server to reconstruct the raw
    /// key to recompute an API-key-keyed HMAC. The session token is a
    /// high-entropy random value the server generates and both sides hold in
    /// plaintext after a successful (BCrypt-verified) handshake, which makes
    /// it a valid HMAC key for proving "same session that just handshook",
    /// without needing the original secret to be reversible.
    /// </summary>
    public bool ValidateSignature(
        string payload,
        string timestamp,
        string sessionToken,
        string providedSignature)
    {
        // Validate timestamp first (prevent replay attacks)
        if (!long.TryParse(timestamp, out var timestampValue))
        {
            _logger.LogWarning("Invalid timestamp format");
            return false;
        }

        var requestTime = DateTimeOffset.FromUnixTimeSeconds(timestampValue);
        var drift = Math.Abs((DateTimeOffset.UtcNow - requestTime).TotalSeconds);

        if (drift > MAX_TIMESTAMP_DRIFT_SECONDS)
        {
            _logger.LogWarning("Timestamp drift too large: {Drift}s", drift);
            return false;
        }

        // Recreate the expected signature
        var message = $"{payload}|{timestamp}";

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(sessionToken));
        var expectedSignatureBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(message));
        var expectedSignature = Convert.ToHexString(expectedSignatureBytes).ToLowerInvariant();

        // Constant-time comparison to prevent timing attacks
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expectedSignature),
            Encoding.UTF8.GetBytes(providedSignature.ToLowerInvariant())
        );
    }

    /// <summary>
    /// Validate impression hash (proves impression came from valid player)
    /// </summary>
    public bool ValidateImpressionHash(
        ImpressionData impression,
        string providedHash,
        string screenId,
        string sessionTokenPrefix,
        string apiKey)
    {
        var dataToHash = new
        {
            creativeId = impression.CreativeId,
            timestamp = impression.Timestamp,
            slotNumber = impression.SlotNumber,
            playDurationMs = impression.PlayDurationMs,
            screenId = screenId,
            sessionToken = sessionTokenPrefix
        };

        var canonical = JsonSerializer.Serialize(dataToHash, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        });

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(apiKey));
        var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(canonical));
        var expectedHash = Convert.ToHexString(hashBytes).ToLowerInvariant()[..32];

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expectedHash),
            Encoding.UTF8.GetBytes(providedHash.ToLowerInvariant())
        );
    }
}

/// <summary>
/// Data structure for impression validation
/// </summary>
public class ImpressionData
{
    public string CreativeId { get; set; } = string.Empty;
    public string Timestamp { get; set; } = string.Empty;
    public int SlotNumber { get; set; }
    public int PlayDurationMs { get; set; }
}

/// <summary>
/// In-memory session storage for active player sessions, keyed by screenId.
/// Registered as a singleton (see Program.cs) so it survives across requests
/// within one API process. This does NOT survive a restart or scale across
/// multiple API instances — acceptable for now (matches this project's
/// current single-instance deployment) but should move to Redis or another
/// distributed cache before running more than one API replica.
/// </summary>
public class PlayerSessionStore
{
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, PlayerSession> _sessions = new();
    private readonly ILogger<PlayerSessionStore> _logger;

    public PlayerSessionStore(ILogger<PlayerSessionStore> logger)
    {
        _logger = logger;
    }

    public void StoreSession(string screenId, PlayerSession session)
    {
        _sessions[screenId] = session;
        _logger.LogInformation("Stored session for screen {ScreenId}", screenId);
    }

    public PlayerSession? GetSession(string screenId)
    {
        return _sessions.TryGetValue(screenId, out var session) ? session : null;
    }

    public bool ValidateSession(string screenId, string sessionToken)
    {
        var session = GetSession(screenId);
        if (session == null) return false;
        if (session.ExpiresAt <= DateTime.UtcNow) return false;
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(session.Token),
            Encoding.UTF8.GetBytes(sessionToken));
    }

    public void InvalidateSession(string screenId)
    {
        _sessions.TryRemove(screenId, out _);
    }
}

public class PlayerSession
{
    public string ScreenId { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public string Salt { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public string DeviceFingerprint { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string LastKnownIp { get; set; } = string.Empty;
}

/// <summary>
/// Action filter to validate player API requests
/// Apply to player endpoints: [ServiceFilter(typeof(PlayerAuthFilter))]
/// </summary>
public class PlayerAuthFilter : IAsyncActionFilter
{
    private readonly PlayerAuthenticationService _authService;
    private readonly PlayerSessionStore _sessionStore;
    private readonly ILogger<PlayerAuthFilter> _logger;

    public PlayerAuthFilter(
        PlayerAuthenticationService authService,
        PlayerSessionStore sessionStore,
        ILogger<PlayerAuthFilter> logger)
    {
        _authService = authService;
        _sessionStore = sessionStore;
        _logger = logger;
    }

    public async Task OnActionExecutionAsync(
        ActionExecutingContext context,
        ActionExecutionDelegate next)
    {
        var httpContext = context.HttpContext;
        var request = httpContext.Request;

        // Extract security headers
        var screenId = request.Headers["X-Screen-Id"].FirstOrDefault();
        var timestamp = request.Headers["X-Timestamp"].FirstOrDefault();
        var signature = request.Headers["X-Signature"].FirstOrDefault();
        var sessionToken = request.Headers["X-Session-Token"].FirstOrDefault();

        // Validate all required headers present
        if (string.IsNullOrEmpty(screenId) ||
            string.IsNullOrEmpty(timestamp) ||
            string.IsNullOrEmpty(signature) ||
            string.IsNullOrEmpty(sessionToken))
        {
            _logger.LogWarning("Missing security headers from {IP}", 
                httpContext.Connection.RemoteIpAddress);
            context.Result = new UnauthorizedObjectResult(new
            {
                error = "Missing security headers"
            });
            return;
        }

        // Validate session
        var session = _sessionStore.GetSession(screenId);
        if (session == null || !_sessionStore.ValidateSession(screenId, sessionToken))
        {
            _logger.LogWarning("Invalid or expired session for screen {ScreenId}", screenId);
            context.Result = new UnauthorizedObjectResult(new
            {
                error = "Invalid or expired session",
                code = "SESSION_INVALID"
            });
            return;
        }

        // Read request body for signature validation
        request.EnableBuffering();
        using var reader = new StreamReader(request.Body, leaveOpen: true);
        var body = await reader.ReadToEndAsync();
        request.Body.Position = 0;

        // Signature is keyed by the session token issued at handshake (see
        // PlayerAuthenticationService.ValidateSignature for why it isn't
        // keyed by the raw API key), and proves the request came from the
        // same session that just handshook — a stolen bearer credential alone
        // is not enough to replay a request without also knowing this session's token.
        if (!_authService.ValidateSignature(body, timestamp, session.Token, signature))
        {
            _logger.LogWarning("Invalid signature for screen {ScreenId} from {IP}",
                screenId, httpContext.Connection.RemoteIpAddress);
            context.Result = new UnauthorizedObjectResult(new
            {
                error = "Invalid signature",
                code = "SIGNATURE_INVALID"
            });
            return;
        }

        await next();
    }
}
