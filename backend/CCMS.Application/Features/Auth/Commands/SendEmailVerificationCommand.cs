using MediatR;

namespace CCMS.Application.Features.Auth.Commands;

/// <summary>
/// Command to send email verification link to user
/// </summary>
public record SendEmailVerificationCommand(string Email) : IRequest<SendEmailVerificationResult>;

public class SendEmailVerificationResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public DateTime? ExpiresAt { get; set; }
    
    public static SendEmailVerificationResult Succeeded(DateTime expiresAt) 
        => new() { Success = true, Message = "Verification email sent", ExpiresAt = expiresAt };
    
    public static SendEmailVerificationResult Failed(string message) 
        => new() { Success = false, Message = message };
}
