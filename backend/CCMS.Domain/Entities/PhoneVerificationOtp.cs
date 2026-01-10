namespace CCMS.Domain.Entities;

/// <summary>
/// OTP for phone verification - sent via SMS
/// Includes rate limiting tracking (max 5 per phone per hour)
/// </summary>
public class PhoneVerificationOtp : BaseEntity
{
    public Guid UserId { get; set; }
    public required string PhoneNumber { get; set; }
    public required string OtpCode { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; }
    public DateTime? UsedAt { get; set; }
    public int AttemptCount { get; set; } // Track verification attempts (max 3)
    
    // Navigation property
    public virtual User User { get; set; } = null!;
    
    /// <summary>
    /// Check if OTP is valid (not expired, not used, attempts not exceeded)
    /// </summary>
    public bool IsValid => !IsUsed && DateTime.UtcNow < ExpiresAt && AttemptCount < 3;
    
    /// <summary>
    /// OTP expiry duration (10 minutes)
    /// </summary>
    public static readonly TimeSpan OtpValidityDuration = TimeSpan.FromMinutes(10);
    
    /// <summary>
    /// Rate limit window (1 hour)
    /// </summary>
    public static readonly TimeSpan RateLimitWindow = TimeSpan.FromHours(1);
    
    /// <summary>
    /// Max OTPs per phone per hour
    /// </summary>
    public const int MaxOtpsPerHour = 5;
}
