using System.ComponentModel.DataAnnotations;

namespace CCMS.Shared.DTOs.Auth;

public class RegisterRequest
{
    [Required]
    [EmailAddress]
    [StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [StringLength(100, MinimumLength = 8)]
    public string Password { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string LastName { get; set; } = string.Empty;

    [Required]
    [StringLength(20)]
    public string PhoneNumber { get; set; } = string.Empty; // Required for registration

    [StringLength(50)]
    public string Role { get; set; } = "Advertiser"; // "ScreenOwner" or "Advertiser"

    [StringLength(20)]
    public string? Visibility { get; set; } // "Public" (default) or "Private" — only applies to ScreenOwner

    /// <summary>
    /// Product mode chosen at registration: "CmsOwner", "MediaOwner", or "Advertiser".
    /// Optional — if omitted, derived from Role (ScreenOwner→MediaOwner, Advertiser→Advertiser).
    /// </summary>
    [StringLength(50)]
    public string? AccountType { get; set; }
}

public class LoginRequest
{
    [Required]
    [EmailAddress]
    [StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string Password { get; set; } = string.Empty;
}

public class AuthResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public UserDto User { get; set; } = null!;
    
    /// <summary>
    /// Indicates user needs to verify email/phone before getting tokens
    /// </summary>
    public bool RequiresVerification { get; set; }
    
    /// <summary>
    /// Message explaining what verification is needed
    /// </summary>
    public string? VerificationMessage { get; set; }
    
    /// <summary>
    /// Whether email is verified
    /// </summary>
    public bool IsEmailVerified { get; set; }
    
    /// <summary>
    /// Whether phone is verified
    /// </summary>
    public bool IsPhoneVerified { get; set; }
    
    /// <summary>
    /// User's email (for verification page redirect)
    /// </summary>
    public string? Email { get; set; }
    
    /// <summary>
    /// Masked phone number (for display on verification page)
    /// </summary>
    public string? PhoneNumber { get; set; }
}

public class RefreshTokenRequest
{
    public string RefreshToken { get; set; } = string.Empty;
}
