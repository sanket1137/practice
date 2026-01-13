using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;

namespace CCMS.Application.Features.Auth.Commands;

public class VerifyEmailCommandHandler : IRequestHandler<VerifyEmailCommand, VerifyEmailResult>
{
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<EmailVerificationToken> _tokenRepository;
    private readonly IEmailService _emailService;
    private readonly ILogger<VerifyEmailCommandHandler> _logger;

    public VerifyEmailCommandHandler(
        IRepository<User> userRepository,
        IRepository<EmailVerificationToken> tokenRepository,
        IEmailService emailService,
        ILogger<VerifyEmailCommandHandler> logger)
    {
        _userRepository = userRepository;
        _tokenRepository = tokenRepository;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<VerifyEmailResult> Handle(
        VerifyEmailCommand request, 
        CancellationToken cancellationToken)
    {
        // Find token
        var tokens = await _tokenRepository.FindAsync(t => t.Token == request.Token, cancellationToken);
        var token = tokens.FirstOrDefault();

        if (token == null)
        {
            _logger.LogWarning("Invalid email verification token attempted");
            return VerifyEmailResult.Failed("Invalid verification link");
        }

        // Check if token is valid
        if (token.IsUsed)
        {
            return VerifyEmailResult.Failed("This verification link has already been used");
        }

        if (DateTime.UtcNow > token.ExpiresAt)
        {
            return VerifyEmailResult.Failed("This verification link has expired. Please request a new one.");
        }

        // Get the user
        var user = await _userRepository.GetByIdAsync(token.UserId, cancellationToken);
        if (user == null)
        {
            _logger.LogWarning("User not found for token {TokenId}", token.Id);
            return VerifyEmailResult.Failed("User not found");
        }

        // Mark token as used
        token.IsUsed = true;
        token.UsedAt = DateTime.UtcNow;
        await _tokenRepository.UpdateAsync(token, cancellationToken);

        // Verify user's email
        user.IsEmailVerified = true;
        await _userRepository.UpdateAsync(user, cancellationToken);

        _logger.LogInformation("Email verified for user {Email}", user.Email);

        // Send welcome email
        await _emailService.SendWelcomeEmailAsync(user.Email, user.FirstName);

        var isFullyVerified = user.IsEmailVerified && user.IsPhoneVerified;
        return VerifyEmailResult.Succeeded(user.Email, isFullyVerified, user.IsPhoneVerified);
    }
}
