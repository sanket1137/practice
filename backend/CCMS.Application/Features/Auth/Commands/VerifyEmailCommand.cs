using MediatR;

namespace CCMS.Application.Features.Auth.Commands;

/// <summary>
/// Command to verify email using token from verification link
/// </summary>
public record VerifyEmailCommand(string Token) : IRequest<VerifyEmailResult>;

public class VerifyEmailResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? Email { get; set; }
    public bool IsFullyVerified { get; set; }
    public bool IsEmailVerified { get; set; }
    public bool IsPhoneVerified { get; set; }
    
    public static VerifyEmailResult Succeeded(string email, bool isFullyVerified, bool isPhoneVerified) 
        => new() 
        { 
            Success = true, 
            Message = "Email verified successfully", 
            Email = email,
            IsFullyVerified = isFullyVerified,
            IsEmailVerified = true,
            IsPhoneVerified = isPhoneVerified
        };
    
    public static VerifyEmailResult Failed(string message) 
        => new() { Success = false, Message = message };
}
