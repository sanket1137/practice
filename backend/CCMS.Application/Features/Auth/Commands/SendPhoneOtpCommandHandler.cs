using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;

namespace CCMS.Application.Features.Auth.Commands;

public class SendPhoneOtpCommandHandler : IRequestHandler<SendPhoneOtpCommand, SendPhoneOtpResult>
{
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<PhoneVerificationOtp> _otpRepository;
    private readonly ISmsService _smsService;
    private readonly ILogger<SendPhoneOtpCommandHandler> _logger;

    public SendPhoneOtpCommandHandler(
        IRepository<User> userRepository,
        IRepository<PhoneVerificationOtp> otpRepository,
        ISmsService smsService,
        ILogger<SendPhoneOtpCommandHandler> logger)
    {
        _userRepository = userRepository;
        _otpRepository = otpRepository;
        _smsService = smsService;
        _logger = logger;
    }

    public async Task<SendPhoneOtpResult> Handle(
        SendPhoneOtpCommand request, 
        CancellationToken cancellationToken)
    {
        // Find user by email
        var users = await _userRepository.FindAsync(u => u.Email == request.Email, cancellationToken);
        var user = users.FirstOrDefault();

        if (user == null)
        {
            return SendPhoneOtpResult.Failed("User not found");
        }

        // Validate and normalize phone number
        var normalizedPhone = _smsService.NormalizePhoneNumber(request.PhoneNumber);
        if (!_smsService.ValidatePhoneNumber(normalizedPhone))
        {
            return SendPhoneOtpResult.Failed("Invalid phone number format. Please enter a valid 10-digit Indian mobile number.");
        }

        // Check if phone already verified
        if (user.IsPhoneVerified && user.PhoneNumber == normalizedPhone)
        {
            return SendPhoneOtpResult.Failed("This phone number is already verified");
        }

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

        // Update user's phone number
        user.PhoneNumber = normalizedPhone;
        await _userRepository.UpdateAsync(user, cancellationToken);

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
            "OTP sent to {Phone} for user {Email}. Expires at {ExpiresAt}", 
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
