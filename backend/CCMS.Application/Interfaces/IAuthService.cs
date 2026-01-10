using CCMS.Shared.DTOs.Auth;

namespace CCMS.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task RevokeTokenAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task<VerificationStatusResponse> GetVerificationStatusAsync(string email, CancellationToken cancellationToken = default);
}

/// <summary>
/// Response containing user's verification status
/// </summary>
public class VerificationStatusResponse
{
    public string Email { get; set; } = string.Empty;
    public bool IsEmailVerified { get; set; }
    public bool IsPhoneVerified { get; set; }
    public string? PhoneNumber { get; set; }
    public bool IsFullyVerified => IsEmailVerified && IsPhoneVerified;
}
