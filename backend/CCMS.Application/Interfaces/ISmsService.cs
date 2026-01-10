namespace CCMS.Application.Interfaces;

/// <summary>
/// Service for sending SMS via ComBirds API
/// </summary>
public interface ISmsService
{
    /// <summary>
    /// Send OTP to phone number for verification
    /// </summary>
    /// <param name="phoneNumber">10-digit Indian mobile number</param>
    /// <param name="otp">6-digit OTP code</param>
    /// <returns>True if SMS sent successfully</returns>
    Task<bool> SendOtpAsync(string phoneNumber, string otp);
    
    /// <summary>
    /// Validate phone number format (10-digit Indian mobile)
    /// </summary>
    /// <param name="phoneNumber">Phone number to validate</param>
    /// <returns>True if valid format</returns>
    bool ValidatePhoneNumber(string phoneNumber);
    
    /// <summary>
    /// Normalize phone number to standard format (remove +91, spaces, etc.)
    /// </summary>
    /// <param name="phoneNumber">Raw phone number input</param>
    /// <returns>Normalized 10-digit number</returns>
    string NormalizePhoneNumber(string phoneNumber);
}

/// <summary>
/// Result of OTP verification attempt
/// </summary>
public class OtpVerificationResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public int RemainingAttempts { get; set; }
    
    public static OtpVerificationResult Succeeded() => new() { Success = true };
    
    public static OtpVerificationResult Failed(string message, int remainingAttempts = 0) 
        => new() { Success = false, ErrorMessage = message, RemainingAttempts = remainingAttempts };
}
