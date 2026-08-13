using MediatR;

namespace CCMS.Application.Features.Auth.Commands;

/// <summary>
/// Command to verify phone using OTP
/// Max 3 verification attempts per OTP
/// </summary>
public record VerifyPhoneOtpCommand(string Email, string Otp) : IRequest<VerifyPhoneOtpResult>;

public class VerifyPhoneOtpResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? PhoneNumber { get; set; }
    public int RemainingAttempts { get; set; }
    public bool IsFullyVerified { get; set; } // Both email and phone verified
    public bool IsEmailVerified { get; set; }
    public bool IsPhoneVerified { get; set; }
    
    public static VerifyPhoneOtpResult Succeeded(string phoneNumber, bool isFullyVerified, bool isEmailVerified) 
        => new() 
        { 
            Success = true, 
            Message = "Phone number verified successfully", 
            PhoneNumber = phoneNumber,
            IsFullyVerified = isFullyVerified,
            IsEmailVerified = isEmailVerified,
            IsPhoneVerified = true
        };
    
    public static VerifyPhoneOtpResult Failed(string message, int remainingAttempts = 0) 
        => new() { Success = false, Message = message, RemainingAttempts = remainingAttempts };
}
