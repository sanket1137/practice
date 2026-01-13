using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;

namespace CCMS.Application.Features.Auth.Commands;

/// <summary>
/// Handler for ResendPhoneOtpCommand - resends OTP using user's phone on file
/// </summary>
public class ResendPhoneOtpCommandHandler : IRequestHandler<ResendPhoneOtpCommand, SendPhoneOtpResult>
{
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<PhoneVerificationOtp> _otpRepository;
    private readonly ISmsService _smsService;
    private readonly ILogger<ResendPhoneOtpCommandHandler> _logger;

    public ResendPhoneOtpCommandHandler(
        IRepository<User> userRepository,
        IRepository<PhoneVerificationOtp> otpRepository,
        ISmsService smsService,
        ILogger<ResendPhoneOtpCommandHandler> logger)
    {
        _userRepository = userRepository;
        _otpRepository = otpRepository;
        _smsService = smsService;
        _logger = logger;
    }

    public async Task<SendPhoneOtpResult> Handle(
        ResendPhoneOtpCommand request, 
        CancellationToken cancellationToken)
    {
        // Find user by email
        var users = await _userRepository.FindAsync(u => u.Email == request.Email, cancellationToken);
        var user = users.FirstOrDefault();

        if (user == null)
        {
            return SendPhoneOtpResult.Failed("User not found");
        }

        // Check if user has a phone number on file
        if (string.IsNullOrEmpty(user.PhoneNumber))
        {
            return SendPhoneOtpResult.Failed("No phone number on file. Please provide your phone number.");
        }

        // Check if phone already verified
        if (user.IsPhoneVerified)
        {
            return SendPhoneOtpResult.Failed("Your phone number is already verified");
        }

        var normalizedPhone = user.PhoneNumber;

        // Check rate limit: max 5 OTPs per phone per hour
        var rateLimitWindow = DateTime.UtcNow.Subtract(PhoneVerificationOtp.RateLimitWindow);
        var recentOtps = await _otpRepository.FindAsync(
            o => o.PhoneNumber == normalizedPhone && o.CreatedAt > rateLimitWindow, 
            cancellationToken);
        var recentOtpCount = recentOtps.Count();

        var remainingAttempts = PhoneVerificationOtp.MaxOtpsPerHour - recentOtpCount - 1;

        if (recentOtpCount >= PhoneVerificationOtp.MaxOtpsPerHour)
        {
            _logger.LogWarning(
                "Rate limit exceeded for phone {Phone}. Count: {Count}", 
                MaskPhone(normalizedPhone), recentOtpCount);
            return SendPhoneOtpResult.Failed(
                "Too many OTP requests. Please try again in an hour.", 
                remainingAttempts: 0);
        }

        // Invalidate any existing unused OTPs for this user
        var existingOtps = await _otpRepository.FindAsync(
            o => o.UserId == user.Id && !o.IsUsed, 
            cancellationToken);

        foreach (var otp in existingOtps)
        {
            otp.IsUsed = true;
            otp.UsedAt = DateTime.UtcNow;
            await _otpRepository.UpdateAsync(otp, cancellationToken);
        }

        // Generate 6-digit OTP
        var otpCode = GenerateOtp();

        // Create new OTP record
        var phoneOtp = new PhoneVerificationOtp
        {
            UserId = user.Id,
            PhoneNumber = normalizedPhone,
            OtpCode = otpCode,
            ExpiresAt = DateTime.UtcNow.Add(PhoneVerificationOtp.OtpValidityDuration),
            IsUsed = false,
            AttemptCount = 0
        };

        await _otpRepository.AddAsync(phoneOtp, cancellationToken);

        // Send OTP via SMS
        var smsSent = await _smsService.SendOtpAsync(normalizedPhone, otpCode);

        if (!smsSent)
        {
            _logger.LogError("Failed to send OTP to {Phone}", MaskPhone(normalizedPhone));
            return SendPhoneOtpResult.Failed(
                "Failed to send OTP. Please try again.", 
                remainingAttempts);
        }

        _logger.LogInformation(
            "OTP resent to {Phone} for user {Email}. Expires at {ExpiresAt}", 
            MaskPhone(normalizedPhone), user.Email, phoneOtp.ExpiresAt);

        return SendPhoneOtpResult.Succeeded(phoneOtp.ExpiresAt, remainingAttempts);
    }

    private static string GenerateOtp()
    {
        using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
        var bytes = new byte[4];
        rng.GetBytes(bytes);
        var value = BitConverter.ToUInt32(bytes, 0) % 1000000;
        return value.ToString("D6"); // 6-digit zero-padded
    }

    private static string MaskPhone(string phone)
    {
        if (string.IsNullOrEmpty(phone) || phone.Length < 6)
            return "***";
        return $"{phone[..3]}****{phone[^3..]}";
    }
}
