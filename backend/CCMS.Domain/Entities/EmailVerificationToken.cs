namespace CCMS.Domain.Entities;

/// <summary>
/// Token for email verification - sent via link to user's email
/// </summary>
public class EmailVerificationToken : BaseEntity
{
    public Guid UserId { get; set; }
    public required string Token { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; }
    public DateTime? UsedAt { get; set; }
    
    // Navigation property
    public virtual User User { get; set; } = null!;
    
    /// <summary>
    /// Check if token is valid (not expired and not used)
    /// </summary>
    public bool IsValid => !IsUsed && DateTime.UtcNow < ExpiresAt;
}
