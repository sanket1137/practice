using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.ValueObjects;
using CCMS.Infrastructure.Data;
using CCMS.Shared.DTOs.Player;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CCMS.Infrastructure.Services;

public class PlayerPairingService : IPlayerPairingService
{
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromMinutes(30);

    private readonly ApplicationDbContext _context;
    private readonly ILogger<PlayerPairingService> _logger;

    public PlayerPairingService(ApplicationDbContext context, ILogger<PlayerPairingService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<RequestPlayerPairingTokenResponse> RequestTokenAsync(
        RequestPlayerPairingTokenRequest request,
        string baseUrl,
        CancellationToken ct = default)
    {
        var token = GenerateToken();
        var fingerprintHash = HashFingerprint(request.DeviceFingerprint);

        var entity = new PlayerPairingToken
        {
            Token = token,
            DeviceFingerprintHash = fingerprintHash,
            DeviceModel = request.DeviceModel,
            OsVersion = request.OsVersion,
            AppVersion = request.AppVersion,
            ExpiresAt = DateTime.UtcNow.Add(TokenLifetime),
        };
        _context.PlayerPairingTokens.Add(entity);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Player pairing token {Token} created (device={Model}, expires={Exp:o})",
            token, request.DeviceModel, entity.ExpiresAt);

        return new RequestPlayerPairingTokenResponse
        {
            Token = token,
            QrContent = $"{baseUrl}/player-pair?token={token}",
            ExpiresAt = entity.ExpiresAt,
        };
    }

    public async Task<PlayerPairingStatusResponse> GetStatusAsync(string token, CancellationToken ct = default)
    {
        var entity = await _context.PlayerPairingTokens
            .FirstOrDefaultAsync(p => p.Token == token, ct);

        if (entity == null)
            return new PlayerPairingStatusResponse { IsExpired = true };

        var apiKey = entity.ApiKey;
        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            entity.ApiKey = null;
            await _context.SaveChangesAsync(ct);
        }

        return new PlayerPairingStatusResponse
        {
            IsClaimed = entity.ClaimedAt.HasValue,
            IsExpired = !entity.ClaimedAt.HasValue && entity.ExpiresAt <= DateTime.UtcNow,
            ScreenId = entity.ScreenId,
            ApiKey = apiKey,
        };
    }

    public async Task<ClaimPlayerQrResponse> ClaimAsCmsAsync(
        Guid userId,
        ClaimPlayerQrCmsRequest request,
        CancellationToken ct = default)
    {
        var (pairing, _) = await ValidateClaim(request.Token, userId, AccountType.CmsOwner, ct);

        var orientation = Enum.TryParse<ScreenOrientation>(request.Orientation, true, out var o)
            ? o : ScreenOrientation.Landscape;

        var rawApiKey = GenerateApiKey();
        var screen = new Screen
        {
            OwnerId = userId,
            Name = request.ScreenName,
            Description = string.Empty,
            Orientation = orientation,
            ResolutionWidth = request.ResolutionWidth,
            ResolutionHeight = request.ResolutionHeight,
            LocationTag = request.Venue,
            Location = new Address(),
            Timezone = "Asia/Kolkata",
            Schedule = new OperatingSchedule(),
            TimeFrameMinutes = 10,
            SlotsPerFrame = 6,
            DeviceId = pairing.DeviceFingerprintHash,
            Status = ScreenStatus.Active,
            IsOnline = false,
            ApiKeyHash = BCrypt.Net.BCrypt.HashPassword(rawApiKey),
            DeviceFingerprintHash = pairing.DeviceFingerprintHash,
            DeviceBoundAt = DateTime.UtcNow,
            DisplayType = ScreenDisplayType.Indoor,
            PricePerSlot = 0,
            Currency = "INR",
        };
        _context.Screens.Add(screen);

        pairing.ClaimedAt = DateTime.UtcNow;
        pairing.ClaimedByUserId = userId;
        pairing.ScreenId = screen.Id;
        pairing.ApiKey = rawApiKey; // Stored temporarily; cleared on first poll

        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Player pairing {Token} claimed by CMS owner {UserId} -> screen {ScreenId}",
            request.Token, userId, screen.Id);

        return new ClaimPlayerQrResponse { ScreenId = screen.Id, ScreenName = screen.Name };
    }

    public async Task<ClaimPlayerQrResponse> ClaimAsCcmsAsync(
        Guid userId,
        ClaimPlayerQrCcmsRequest request,
        CancellationToken ct = default)
    {
        var (pairing, _) = await ValidateClaim(request.Token, userId, AccountType.MediaOwner, ct);

        var orientation = Enum.TryParse<ScreenOrientation>(request.Orientation, true, out var o)
            ? o : ScreenOrientation.Landscape;

        var schedule = request.Schedule != null
            ? JsonSerializer.Deserialize<OperatingSchedule>(
                JsonSerializer.Serialize(request.Schedule)) ?? new OperatingSchedule()
            : new OperatingSchedule();

        var rawApiKey = GenerateApiKey();
        var screen = new Screen
        {
            OwnerId = userId,
            Name = request.ScreenName,
            Description = request.Description,
            Orientation = orientation,
            ResolutionWidth = request.ResolutionWidth,
            ResolutionHeight = request.ResolutionHeight,
            Location = new Address
            {
                Street = request.Street,
                City = request.City,
                State = request.State,
                Country = request.Country,
                PostalCode = request.PostalCode,
            },
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            Timezone = request.Timezone,
            Schedule = schedule,
            TimeFrameMinutes = request.TimeFrameMinutes,
            SlotsPerFrame = request.SlotsPerFrame,
            DeviceId = pairing.DeviceFingerprintHash,
            Status = ScreenStatus.Active,
            IsOnline = false,
            ApiKeyHash = BCrypt.Net.BCrypt.HashPassword(rawApiKey),
            DeviceFingerprintHash = pairing.DeviceFingerprintHash,
            DeviceBoundAt = DateTime.UtcNow,
            DisplayType = ScreenDisplayType.Indoor,
            PricePerSlot = request.PricePerSlot,
            Currency = request.Currency,
        };
        _context.Screens.Add(screen);

        pairing.ClaimedAt = DateTime.UtcNow;
        pairing.ClaimedByUserId = userId;
        pairing.ScreenId = screen.Id;
        pairing.ApiKey = rawApiKey;

        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Player pairing {Token} claimed by CCMS owner {UserId} -> screen {ScreenId}",
            request.Token, userId, screen.Id);

        return new ClaimPlayerQrResponse { ScreenId = screen.Id, ScreenName = screen.Name };
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<(PlayerPairingToken pairing, User user)> ValidateClaim(
        string token, Guid userId, AccountType requiredType, CancellationToken ct)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new KeyNotFoundException("User not found");

        if (user.AccountType != requiredType)
            throw new InvalidOperationException(
                $"Account type {requiredType} required to perform this claim");

        var pairing = await _context.PlayerPairingTokens
            .FirstOrDefaultAsync(p => p.Token == token, ct)
            ?? throw new KeyNotFoundException("Pairing token not found");

        if (pairing.ClaimedAt.HasValue)
            throw new InvalidOperationException("This token has already been claimed");

        if (pairing.ExpiresAt <= DateTime.UtcNow)
            throw new InvalidOperationException("This token has expired");

        return (pairing, user);
    }

    private static string GenerateToken()
    {
        var bytes = new byte[24];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }

    private static string GenerateApiKey()
    {
        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }

    private static string HashFingerprint(string fingerprint)
    {
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(fingerprint));
        return Convert.ToHexString(bytes);
    }
}
