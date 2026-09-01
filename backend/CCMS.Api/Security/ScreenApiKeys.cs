using CCMS.Domain.Entities;

namespace CCMS.Api.Security;

/// <summary>
/// The one place a player-supplied API key is checked against a screen. Every
/// authentication site (REST handshake/heartbeat/sync, verification endpoints,
/// streaming registration, all hubs) goes through here so key rotation behaves
/// identically everywhere: after a rotation, the previous key keeps working
/// for a grace window while the operator reconfigures the player — zero
/// downtime — and then expires on its own.
/// </summary>
public static class ScreenApiKeys
{
    public static readonly TimeSpan RotationGrace = TimeSpan.FromHours(24);

    public static bool Verify(Screen screen, string? providedKey)
        => Verify(screen, providedKey, out _);

    /// <param name="usedPreviousKey">True when the key matched only the
    /// pre-rotation hash inside the grace window — callers may log it so the
    /// Device panel can show "player still on the old key".</param>
    public static bool Verify(Screen screen, string? providedKey, out bool usedPreviousKey)
    {
        usedPreviousKey = false;
        if (string.IsNullOrEmpty(providedKey)) return false;

        if (!string.IsNullOrEmpty(screen.ApiKeyHash) &&
            BCrypt.Net.BCrypt.Verify(providedKey, screen.ApiKeyHash))
        {
            return true;
        }

        if (!string.IsNullOrEmpty(screen.ApiKeyHashPrevious) &&
            screen.ApiKeyRotatedAt.HasValue &&
            DateTime.UtcNow - screen.ApiKeyRotatedAt.Value < RotationGrace &&
            BCrypt.Net.BCrypt.Verify(providedKey, screen.ApiKeyHashPrevious))
        {
            usedPreviousKey = true;
            return true;
        }

        return false;
    }

    /// <summary>Raw-hash overload for call sites that project columns instead of loading the entity.</summary>
    public static bool Verify(string? providedKey, string? currentHash, string? previousHash, DateTime? rotatedAt)
    {
        if (string.IsNullOrEmpty(providedKey)) return false;

        if (!string.IsNullOrEmpty(currentHash) && BCrypt.Net.BCrypt.Verify(providedKey, currentHash))
            return true;

        return !string.IsNullOrEmpty(previousHash)
            && rotatedAt.HasValue
            && DateTime.UtcNow - rotatedAt.Value < RotationGrace
            && BCrypt.Net.BCrypt.Verify(providedKey, previousHash);
    }
}
