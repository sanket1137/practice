using System.Security.Cryptography;
using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.ValueObjects;
using CCMS.Infrastructure.Data;
using CCMS.Shared.DTOs.Cms;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CCMS.Infrastructure.Services;

public class CmsPairingService : ICmsPairingService
{
    private static readonly TimeSpan CodeLifetime = TimeSpan.FromMinutes(10);

    // No ambiguous chars (no 0/O, 1/I).
    private const string CodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private readonly ApplicationDbContext _context;
    private readonly ILogger<CmsPairingService> _logger;

    public CmsPairingService(ApplicationDbContext context, ILogger<CmsPairingService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<PairingCodeResponse> GenerateAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user is null)
        {
            throw new UnauthorizedAccessException("User not found");
        }
        if (user.AccountType != AccountType.CmsOwner)
        {
            throw new UnauthorizedAccessException("Only CMS owners can generate pairing codes");
        }

        // Generate a unique code (retry on collision — exceedingly rare).
        string code;
        for (var attempt = 0; ; attempt++)
        {
            code = GenerateCode();
            var exists = await _context.PairingCodes
                .AnyAsync(p => p.Code == code && p.ClaimedAt == null && p.ExpiresAt > DateTime.UtcNow, cancellationToken);
            if (!exists) break;
            if (attempt >= 5) throw new InvalidOperationException("Unable to allocate pairing code");
        }

        var entity = new PairingCode
        {
            Code = code,
            CreatedByUserId = userId,
            ExpiresAt = DateTime.UtcNow.Add(CodeLifetime)
        };
        _context.PairingCodes.Add(entity);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Pairing code generated for user {UserId} (expires {ExpiresAt:o})", userId, entity.ExpiresAt);

        return new PairingCodeResponse
        {
            Code = entity.Code,
            ExpiresAt = entity.ExpiresAt,
            QrPayload = $"PIXELSPOT-PAIR:{entity.Code}",
        };
    }

    public async Task<PairingStatusResponse?> GetStatusAsync(string code, Guid userId, CancellationToken cancellationToken = default)
    {
        var entity = await _context.PairingCodes
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Code == code && p.CreatedByUserId == userId, cancellationToken);

        if (entity is null) return null;

        return new PairingStatusResponse
        {
            Code = entity.Code,
            IsClaimed = entity.ClaimedAt != null,
            IsExpired = entity.ClaimedAt == null && entity.ExpiresAt <= DateTime.UtcNow,
            ScreenId = entity.ScreenId,
            ExpiresAt = entity.ExpiresAt
        };
    }

    public async Task<ClaimPairingCodeResponse> ClaimAsync(ClaimPairingCodeRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
        {
            throw new ArgumentException("Pairing code is required", nameof(request));
        }
        if (string.IsNullOrWhiteSpace(request.DeviceFingerprint))
        {
            throw new ArgumentException("Device fingerprint is required", nameof(request));
        }

        var normalizedCode = request.Code.Trim().ToUpperInvariant();
        var pairing = await _context.PairingCodes
            .FirstOrDefaultAsync(p => p.Code == normalizedCode, cancellationToken);

        if (pairing is null)
        {
            throw new InvalidOperationException("Invalid pairing code");
        }
        if (pairing.ClaimedAt != null)
        {
            throw new InvalidOperationException("This pairing code has already been used");
        }
        if (pairing.ExpiresAt <= DateTime.UtcNow)
        {
            throw new InvalidOperationException("This pairing code has expired");
        }

        // Provision a new screen for the code's owner.
        var rawApiKey = GenerateApiKey();
        var orientation = Enum.TryParse<ScreenOrientation>(request.Orientation, true, out var parsedOrientation)
            ? parsedOrientation
            : ScreenOrientation.Landscape;

        var width = request.ResolutionWidth.GetValueOrDefault(1920);
        var height = request.ResolutionHeight.GetValueOrDefault(1080);

        var screen = new Screen
        {
            OwnerId = pairing.CreatedByUserId,
            Name = "Unnamed Screen",
            Description = string.Empty,
            PhysicalWidth = 0,
            PhysicalHeight = 0,
            ResolutionWidth = width,
            ResolutionHeight = height,
            Location = new Address(),
            Timezone = "Asia/Kolkata",
            Schedule = new OperatingSchedule(),
            TimeFrameMinutes = 10,
            SlotsPerFrame = 6,
            DeviceId = request.DeviceFingerprint,
            Status = ScreenStatus.Active,
            IsOnline = true,
            LastSeenAt = DateTime.UtcNow,
            ApiKeyHash = BCrypt.Net.BCrypt.HashPassword(rawApiKey),
            DeviceFingerprintHash = HashFingerprint(request.DeviceFingerprint),
            DeviceBoundAt = DateTime.UtcNow,
            DisplayType = ScreenDisplayType.Indoor,
            Orientation = orientation,
            LocationTag = request.LocationTag,
            PricePerSlot = 0,
            Currency = "INR"
        };
        _context.Screens.Add(screen);

        pairing.ScreenId = screen.Id;
        pairing.ClaimedAt = DateTime.UtcNow;
        pairing.PlayerFingerprint = request.DeviceFingerprint;

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Pairing code {Code} claimed by device {Fingerprint} -> screen {ScreenId}",
            pairing.Code, request.DeviceFingerprint, screen.Id);

        return new ClaimPairingCodeResponse
        {
            ScreenId = screen.Id,
            ApiKey = rawApiKey,
            ScreenName = screen.Name
        };
    }

    private static string GenerateCode()
    {
        Span<byte> buffer = stackalloc byte[6];
        RandomNumberGenerator.Fill(buffer);
        Span<char> chars = stackalloc char[6];
        for (var i = 0; i < 6; i++)
        {
            chars[i] = CodeAlphabet[buffer[i] % CodeAlphabet.Length];
        }
        return new string(chars);
    }

    private static string GenerateApiKey()
    {
        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }

    private static string HashFingerprint(string fingerprint)
    {
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(fingerprint));
        return Convert.ToHexString(bytes);
    }
}
