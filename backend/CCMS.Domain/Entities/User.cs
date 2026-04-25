using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

public class User : BaseEntity
{
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public UserRole Role { get; set; }

    /// <summary>
    /// Top-level product discriminator chosen at registration. Determines
    /// whether the user lands in the CMS dashboard or the marketplace.
    /// Backward compat: existing users are backfilled to MediaOwner (marketplace).
    /// </summary>
    public AccountType AccountType { get; set; } = AccountType.MediaOwner;

    public string? ProfileImageUrl { get; set; }
    public bool IsEmailVerified { get; set; }
    public bool IsPhoneVerified { get; set; }
    public DateTime? LastLoginAt { get; set; }
    
    // User preferences (with India defaults)
    public string PreferredTimezone { get; set; } = "Asia/Kolkata";
    public string PreferredCurrency { get; set; } = "INR";

    // Profile settings
    public string? CompanyName { get; set; }
    public string? GstNumber { get; set; }
    public string ThemePreference { get; set; } = "dark";

    // Screen visibility (account-level: applies to ALL screens)
    public ScreenVisibility AccountVisibility { get; set; } = ScreenVisibility.Public;
    
    // Navigation properties
    public virtual ICollection<Screen> Screens { get; set; } = new List<Screen>();
    public virtual ICollection<Campaign> Campaigns { get; set; } = new List<Campaign>();
    public virtual ICollection<Membership> Memberships { get; set; } = new List<Membership>();
    public virtual ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public virtual ICollection<EmailVerificationToken> EmailVerificationTokens { get; set; } = new List<EmailVerificationToken>();
    public virtual ICollection<PhoneVerificationOtp> PhoneVerificationOtps { get; set; } = new List<PhoneVerificationOtp>();
    public virtual ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public virtual BankAccount? BankAccount { get; set; }
    public virtual ICollection<Payout> Payouts { get; set; } = new List<Payout>();
    public virtual ICollection<Notification> Notifications { get; set; } = new List<Notification>();
    public virtual ICollection<AdminAuthorizedMachine> AuthorizedMachines { get; set; } = new List<AdminAuthorizedMachine>();
    public virtual ICollection<VisibilityChangeRequest> VisibilityChangeRequests { get; set; } = new List<VisibilityChangeRequest>();
}
