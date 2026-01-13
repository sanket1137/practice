using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;

namespace CCMS.Application.Features.Auth.Commands;

public class SendEmailVerificationCommandHandler 
    : IRequestHandler<SendEmailVerificationCommand, SendEmailVerificationResult>
{
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<EmailVerificationToken> _tokenRepository;
    private readonly IEmailService _emailService;
    private readonly ILogger<SendEmailVerificationCommandHandler> _logger;
    
    // Token validity duration: 24 hours
    private static readonly TimeSpan TokenValidityDuration = TimeSpan.FromHours(24);

    public SendEmailVerificationCommandHandler(
        IRepository<User> userRepository,
        IRepository<EmailVerificationToken> tokenRepository,
        IEmailService emailService,
        ILogger<SendEmailVerificationCommandHandler> logger)
    {
        _userRepository = userRepository;
        _tokenRepository = tokenRepository;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<SendEmailVerificationResult> Handle(
        SendEmailVerificationCommand request, 
        CancellationToken cancellationToken)
    {
        // Find user by email
        var users = await _userRepository.FindAsync(u => u.Email == request.Email, cancellationToken);
        var user = users.FirstOrDefault();

        if (user == null)
        {
            _logger.LogWarning("Email verification requested for non-existent email: {Email}", request.Email);
            // Return success to prevent email enumeration
            return SendEmailVerificationResult.Succeeded(DateTime.UtcNow.Add(TokenValidityDuration));
        }

        // Check if already verified
        if (user.IsEmailVerified)
        {
            return SendEmailVerificationResult.Failed("Email is already verified");
        }

        // Invalidate any existing tokens
        var existingTokens = await _tokenRepository.FindAsync(
            t => t.UserId == user.Id && !t.IsUsed, 
            cancellationToken);

        foreach (var token in existingTokens)
        {
            token.IsUsed = true;
            token.UsedAt = DateTime.UtcNow;
            await _tokenRepository.UpdateAsync(token, cancellationToken);
        }

        // Generate new token
        var verificationToken = new EmailVerificationToken
        {
            UserId = user.Id,
            Token = GenerateSecureToken(),
            ExpiresAt = DateTime.UtcNow.Add(TokenValidityDuration),
            IsUsed = false
        };

        await _tokenRepository.AddAsync(verificationToken, cancellationToken);

        // Send email
        var emailSent = await _emailService.SendVerificationEmailAsync(
            user.Email, 
            user.FirstName, 
            verificationToken.Token);

        if (!emailSent)
        {
            _logger.LogError("Failed to send verification email to {Email}", user.Email);
            return SendEmailVerificationResult.Failed("Failed to send verification email. Please try again.");
        }

        _logger.LogInformation(
            "Email verification sent to {Email}. Token expires at {ExpiresAt}", 
            user.Email, verificationToken.ExpiresAt);

        return SendEmailVerificationResult.Succeeded(verificationToken.ExpiresAt);
    }

    private static string GenerateSecureToken()
    {
        // Generate a URL-safe base64 token
        var randomBytes = new byte[32];
        using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .Replace("=", "");
    }
}
