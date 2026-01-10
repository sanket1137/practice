using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;

namespace CCMS.Application.Features.Auth.Commands;

public class VerifyPhoneOtpCommandHandler : IRequestHandler<VerifyPhoneOtpCommand, VerifyPhoneOtpResult>
{
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<PhoneVerificationOtp> _otpRepository;
    private readonly ILogger<VerifyPhoneOtpCommandHandler> _logger;

    public VerifyPhoneOtpCommandHandler(
        IRepository<User> userRepository,
        IRepository<PhoneVerificationOtp> otpRepository,
        ILogger<VerifyPhoneOtpCommandHandler> logger)
    {
        _userRepository = userRepository;
        _otpRepository = otpRepository;
        _logger = logger;
    }

    public async Task<VerifyPhoneOtpResult> Handle(
        VerifyPhoneOtpCommand request, 
        CancellationToken cancellationToken)
    {
        // Find user
        var users = await _userRepository.FindAsync(u => u.Email == request.Email, cancellationToken);
        var user = users.FirstOrDefault();

        if (user == null)
        {
            return VerifyPhoneOtpResult.Failed("User not found");
        }

        // Find the latest unused OTP for this user
        var userOtps = await _otpRepository.FindAsync(
            o => o.UserId == user.Id && !o.IsUsed, 
            cancellationToken);
        var otp = userOtps.OrderByDescending(o => o.CreatedAt).FirstOrDefault();

        if (otp == null)
        {
            return VerifyPhoneOtpResult.Failed("No pending OTP found. Please request a new one.");
        }

        // Check if OTP is expired
        if (DateTime.UtcNow > otp.ExpiresAt)
        {
            otp.IsUsed = true;
            otp.UsedAt = DateTime.UtcNow;
            await _otpRepository.UpdateAsync(otp, cancellationToken);
            return VerifyPhoneOtpResult.Failed("OTP has expired. Please request a new one.");
        }

        // Increment attempt count
        otp.AttemptCount++;
        var remainingAttempts = 3 - otp.AttemptCount;

        // Verify OTP code
        if (otp.OtpCode != request.Otp)
        {
            if (otp.AttemptCount >= 3)
            {
                otp.IsUsed = true;
                otp.UsedAt = DateTime.UtcNow;
                await _otpRepository.UpdateAsync(otp, cancellationToken);
                return VerifyPhoneOtpResult.Failed(
                    "Maximum attempts exceeded. Please request a new OTP.", 
                    remainingAttempts: 0);
            }

            await _otpRepository.UpdateAsync(otp, cancellationToken);
            _logger.LogWarning(
                "Invalid OTP attempt for user {Email}. Attempts: {Attempts}/3", 
                user.Email, otp.AttemptCount);
            return VerifyPhoneOtpResult.Failed(
                $"Invalid OTP. {remainingAttempts} attempt(s) remaining.", 
                remainingAttempts);
        }

        // OTP is correct - verify phone
        otp.IsUsed = true;
        otp.UsedAt = DateTime.UtcNow;
        await _otpRepository.UpdateAsync(otp, cancellationToken);
        
        user.IsPhoneVerified = true;
        user.PhoneNumber = otp.PhoneNumber;
        await _userRepository.UpdateAsync(user, cancellationToken);

        _logger.LogInformation(
            "Phone verified for user {Email}. Phone: {Phone}", 
            user.Email, MaskPhone(otp.PhoneNumber));

        // Check if both email and phone are now verified
        var isFullyVerified = user.IsEmailVerified && user.IsPhoneVerified;

        return VerifyPhoneOtpResult.Succeeded(
            MaskPhone(otp.PhoneNumber), 
            isFullyVerified,
            user.IsEmailVerified);
    }

    private static string MaskPhone(string phone)
    {
        if (string.IsNullOrEmpty(phone) || phone.Length < 6)
            return "***";
        return $"{phone[..3]}****{phone[^3..]}";
    }
}
