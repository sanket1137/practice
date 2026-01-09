using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace CCMS.Application.Features.Auth.Commands;

public class ResetPasswordCommandHandler : IRequestHandler<ResetPasswordCommand, bool>
{
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<PasswordResetToken> _tokenRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<ResetPasswordCommandHandler> _logger;

    public ResetPasswordCommandHandler(
        IRepository<User> userRepository,
        IRepository<PasswordResetToken> tokenRepository,
        IUnitOfWork unitOfWork,
        ILogger<ResetPasswordCommandHandler> logger)
    {
        _userRepository = userRepository;
        _tokenRepository = tokenRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<bool> Handle(ResetPasswordCommand request, CancellationToken cancellationToken)
    {
        var tokens = await _tokenRepository.GetAllAsync(cancellationToken);
        var resetToken = tokens.FirstOrDefault(t => t.Token == request.Token);

        if (resetToken == null)
        {
            _logger.LogWarning("Invalid password reset token attempted");
            throw new UnauthorizedAccessException("Invalid or expired reset token");
        }

        if (resetToken.IsUsed)
        {
            _logger.LogWarning("Already used password reset token attempted");
            throw new UnauthorizedAccessException("This reset token has already been used");
        }

        if (resetToken.ExpiresAt < DateTime.UtcNow)
        {
            _logger.LogWarning("Expired password reset token attempted");
            throw new UnauthorizedAccessException("This reset token has expired");
        }

        // Get user
        var user = await _userRepository.GetByIdAsync(resetToken.UserId, cancellationToken);
        if (user == null)
        {
            throw new KeyNotFoundException("User not found");
        }

        // Hash new password
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;

        // Mark token as used
        resetToken.IsUsed = true;
        resetToken.UsedAt = DateTime.UtcNow;

        await _userRepository.UpdateAsync(user, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Password successfully reset for user: {UserId}", user.Id);

        return true;
    }
}
