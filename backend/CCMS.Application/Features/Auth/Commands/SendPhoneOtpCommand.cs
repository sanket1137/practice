using MediatR;

namespace CCMS.Application.Features.Auth.Commands;

/// <summary>
/// Command to send OTP to user's phone number
/// Rate limited: max 5 OTPs per phone per hour
/// </summary>
public record SendPhoneOtpCommand(string Email, string PhoneNumber) : IRequest<SendPhoneOtpResult>;

public class SendPhoneOtpResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public int RemainingAttempts { get; set; }
    
    public static SendPhoneOtpResult Succeeded(DateTime expiresAt, int remainingAttempts) 
        => new() { Success = true, Message = "OTP sent successfully", ExpiresAt = expiresAt, RemainingAttempts = remainingAttempts };
    
    public static SendPhoneOtpResult Failed(string message, int remainingAttempts = 0) 
        => new() { Success = false, Message = message, RemainingAttempts = remainingAttempts };
}
