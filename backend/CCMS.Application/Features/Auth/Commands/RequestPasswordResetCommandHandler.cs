using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Application.Interfaces;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;

namespace CCMS.Application.Features.Auth.Commands;

public class RequestPasswordResetCommandHandler : IRequestHandler<RequestPasswordResetCommand, bool>
{
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<PasswordResetToken> _tokenRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<RequestPasswordResetCommandHandler> _logger;
    private readonly IEmailService _emailService;

    public RequestPasswordResetCommandHandler(
        IRepository<User> userRepository,
        IRepository<PasswordResetToken> tokenRepository,
        IUnitOfWork unitOfWork,
        ILogger<RequestPasswordResetCommandHandler> logger,
        IEmailService emailService)
    {
        _userRepository = userRepository;
        _tokenRepository = tokenRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _emailService = emailService;
    }

    public async Task<bool> Handle(RequestPasswordResetCommand request, CancellationToken cancellationToken)
    {
        var users = await _userRepository.GetAllAsync(cancellationToken);
        var user = users.FirstOrDefault(u => u.Email.ToLower() == request.Email.ToLower());

        // Don't reveal if email exists (security best practice)
        if (user == null)
        {
            _logger.LogWarning("Password reset requested for non-existent email: {Email}", request.Email);
            return true; // Return true anyway to not reveal email existence
        }

        // Generate secure random token
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        
        // Create reset token (expires in 1 hour)
        var resetToken = new PasswordResetToken
        {
            UserId = user.Id,
            Token = token,
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            IsUsed = false
        };

        await _tokenRepository.AddAsync(resetToken, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Password reset token created for user: {Email}", request.Email);

        var emailSent = await _emailService.SendPasswordResetEmailAsync(user.Email, user.FirstName, token);
        if (!emailSent)
        {
            _logger.LogWarning("Failed to send password reset email to {Email}", request.Email);
        }

        return true;
    }
}
