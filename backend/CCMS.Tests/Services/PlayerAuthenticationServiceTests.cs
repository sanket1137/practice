using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CCMS.Api.Security;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace CCMS.Tests.Services;

public class PlayerAuthenticationServiceTests
{
    private readonly PlayerAuthenticationService _sut;

    public PlayerAuthenticationServiceTests()
    {
        var logger = Mock.Of<ILogger<PlayerAuthenticationService>>();
        var config = new ConfigurationBuilder().Build();
        _sut = new PlayerAuthenticationService(logger, config);
    }

    [Fact]
    public void ValidateApiKey_CorrectKey_ReturnsTrue()
    {
        var apiKey = "test-api-key-12345";
        var hash = _sut.HashApiKey(apiKey);

        _sut.ValidateApiKey(apiKey, hash).Should().BeTrue();
    }

    [Fact]
    public void ValidateApiKey_WrongKey_ReturnsFalse()
    {
        var hash = _sut.HashApiKey("correct-key");

        _sut.ValidateApiKey("wrong-key", hash).Should().BeFalse();
    }

    [Fact]
    public void ValidateApiKey_EmptyKey_ReturnsFalse()
    {
        _sut.ValidateApiKey("", "somehash").Should().BeFalse();
    }

    [Fact]
    public void ValidateApiKey_NullHash_ReturnsFalse()
    {
        _sut.ValidateApiKey("key", null!).Should().BeFalse();
    }

    [Fact]
    public void HashApiKey_ProducesDifferentHashesForSameInput()
    {
        // BCrypt produces different salts each time
        var hash1 = _sut.HashApiKey("my-key");
        var hash2 = _sut.HashApiKey("my-key");

        hash1.Should().NotBe(hash2);
        // But both should validate
        _sut.ValidateApiKey("my-key", hash1).Should().BeTrue();
        _sut.ValidateApiKey("my-key", hash2).Should().BeTrue();
    }

    [Fact]
    public void GetApiKeySha256Hash_IsConsistent()
    {
        var hash1 = _sut.GetApiKeySha256Hash("my-key");
        var hash2 = _sut.GetApiKeySha256Hash("my-key");

        hash1.Should().Be(hash2);
        hash1.Should().HaveLength(64); // SHA256 hex = 64 chars
    }

    [Fact]
    public void GetApiKeySha256Hash_DifferentKeys_DifferentHashes()
    {
        var hash1 = _sut.GetApiKeySha256Hash("key-1");
        var hash2 = _sut.GetApiKeySha256Hash("key-2");

        hash1.Should().NotBe(hash2);
    }

    [Fact]
    public void GenerateSessionToken_ReturnsNonEmptyValues()
    {
        var (token, salt, expiresAt) = _sut.GenerateSessionToken("screen-123");

        token.Should().NotBeNullOrEmpty();
        salt.Should().NotBeNullOrEmpty();
        expiresAt.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public void GenerateSessionToken_ExpiresIn24Hours()
    {
        var before = DateTime.UtcNow.AddHours(23).AddMinutes(59);
        var (_, _, expiresAt) = _sut.GenerateSessionToken("screen-123");
        var after = DateTime.UtcNow.AddHours(24).AddMinutes(1);

        expiresAt.Should().BeAfter(before).And.BeBefore(after);
    }

    // ValidateSignature contract: message = "{payload}|{timestamp}", HMAC-SHA256
    // keyed by the session token, lowercase hex, ±5-minute timestamp drift.
    private static string Sign(string payload, string timestamp, string sessionToken)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(sessionToken));
        var bytes = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{payload}|{timestamp}"));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    [Fact]
    public void ValidateSignature_ValidSignature_ReturnsTrue()
    {
        var payload = "{\"data\":\"test\"}";
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        var sessionToken = "session-token-abc";

        _sut.ValidateSignature(payload, timestamp, sessionToken, Sign(payload, timestamp, sessionToken))
            .Should().BeTrue();
    }

    [Fact]
    public void ValidateSignature_TamperedPayload_ReturnsFalse()
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        var sessionToken = "session-token";

        var sig = Sign("original", timestamp, sessionToken);

        _sut.ValidateSignature("tampered", timestamp, sessionToken, sig)
            .Should().BeFalse();
    }

    [Fact]
    public void ValidateSignature_WrongSessionToken_ReturnsFalse()
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();

        var sig = Sign("payload", timestamp, "token-a");

        _sut.ValidateSignature("payload", timestamp, "token-b", sig)
            .Should().BeFalse();
    }

    [Fact]
    public void ValidateSignature_ExpiredTimestamp_ReturnsFalse()
    {
        // Timestamp from 10 minutes ago exceeds the 5-minute drift window
        var oldTimestamp = (DateTimeOffset.UtcNow.ToUnixTimeSeconds() - 600).ToString();
        var sessionToken = "tok";

        var sig = Sign("payload", oldTimestamp, sessionToken);

        _sut.ValidateSignature("payload", oldTimestamp, sessionToken, sig)
            .Should().BeFalse();
    }

    [Fact]
    public void ValidateSignature_InvalidTimestamp_ReturnsFalse()
    {
        _sut.ValidateSignature("payload", "not-a-number", "tok", "sig")
            .Should().BeFalse();
    }

    [Fact]
    public void ValidateImpressionHash_ValidHash_ReturnsTrue()
    {
        var impression = new ImpressionData
        {
            CreativeId = "creative-1",
            Timestamp = "2026-03-12T10:00:00Z",
            SlotNumber = 3,
            PlayDurationMs = 15000,
        };
        var screenId = "screen-abc";
        var sessionTokenPrefix = "token-prefix";
        var apiKey = "api-key-123";

        // Compute the expected hash
        var dataToHash = new
        {
            creativeId = impression.CreativeId,
            timestamp = impression.Timestamp,
            slotNumber = impression.SlotNumber,
            playDurationMs = impression.PlayDurationMs,
            screenId,
            sessionToken = sessionTokenPrefix,
        };
        var canonical = JsonSerializer.Serialize(dataToHash, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false,
        });
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(apiKey));
        var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(canonical));
        var expectedHash = Convert.ToHexString(hashBytes).ToLowerInvariant()[..32];

        _sut.ValidateImpressionHash(impression, expectedHash, screenId, sessionTokenPrefix, apiKey)
            .Should().BeTrue();
    }

    [Fact]
    public void ValidateImpressionHash_TamperedData_ReturnsFalse()
    {
        var impression = new ImpressionData
        {
            CreativeId = "creative-1",
            Timestamp = "2026-03-12T10:00:00Z",
            SlotNumber = 3,
            PlayDurationMs = 15000,
        };

        _sut.ValidateImpressionHash(impression, "00000000000000000000000000000000", "screen", "token", "key")
            .Should().BeFalse();
    }
}
