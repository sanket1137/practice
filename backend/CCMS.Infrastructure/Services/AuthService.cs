using AutoMapper;
using Microsoft.EntityFrameworkCore;
using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Shared.DTOs.Auth;
using CCMS.Infrastructure.Data;
using Microsoft.Extensions.Logging;

namespace CCMS.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly ApplicationDbContext _context;
    private readonly ITokenService _tokenService;
    private readonly IMapper _mapper;
    private readonly IEmailService _emailService;
    private readonly ISmsService _smsService;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        ApplicationDbContext context,
        ITokenService tokenService,
        IMapper mapper,
        IEmailService emailService,
        ISmsService smsService,
        ILogger<AuthService> logger)
    {
        _context = context;
        _tokenService = tokenService;
        _mapper = mapper;
        _emailService = emailService;
        _smsService = smsService;
        _logger = logger;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
    {
        // Check if user already exists by email
        if (await _context.Users.AnyAsync(u => u.Email == request.Email, cancellationToken))
        {
            throw new InvalidOperationException("User with this email already exists");
        }

        // Phone number is mandatory
        if (string.IsNullOrWhiteSpace(request.PhoneNumber))
        {
            throw new InvalidOperationException("Phone number is required for registration");
        }

        // Normalize and validate phone number
        var normalizedPhone = _smsService.NormalizePhoneNumber(request.PhoneNumber);
        if (!_smsService.ValidatePhoneNumber(normalizedPhone))
        {
            throw new InvalidOperationException("Invalid phone number format. Please enter a valid 10-digit Indian mobile number.");
        }

        // Check if phone number already exists (must be unique)
        if (await _context.Users.AnyAsync(u => u.PhoneNumber == normalizedPhone, cancellationToken))
        {
            throw new InvalidOperationException("This phone number is already registered with another account");
        }

        // Parse role
        if (!Enum.TryParse<UserRole>(request.Role, out var userRole))
        {
            throw new ArgumentException("Invalid role specified");
        }

        // Create user with unverified status
        var user = new User
        {
            Email = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FirstName = request.FirstName,
            LastName = request.LastName,
            PhoneNumber = normalizedPhone,
            Role = userRole,
            IsEmailVerified = false,
            IsPhoneVerified = false
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

        // Generate email verification token
        var verificationToken = GenerateSecureToken();
        var emailToken = new EmailVerificationToken
        {
            UserId = user.Id,
            Token = verificationToken,
            ExpiresAt = DateTime.UtcNow.AddHours(24),
            IsUsed = false
        };
        _context.EmailVerificationTokens.Add(emailToken);
        await _context.SaveChangesAsync(cancellationToken);

        // Send verification email
        await _emailService.SendVerificationEmailAsync(user.Email, user.FirstName, verificationToken);

        // Generate and send phone OTP automatically
        var otp = GenerateOtp();
        var phoneOtp = new PhoneVerificationOtp
        {
            UserId = user.Id,
            PhoneNumber = normalizedPhone,
            OtpCode = otp,
            ExpiresAt = DateTime.UtcNow.Add(PhoneVerificationOtp.OtpValidityDuration),
            IsUsed = false,
            AttemptCount = 0
        };
        _context.Set<PhoneVerificationOtp>().Add(phoneOtp);
        await _context.SaveChangesAsync(cancellationToken);

        // Send OTP via SMS
        var smsSent = await _smsService.SendOtpAsync(normalizedPhone, otp);
        
        _logger.LogInformation(
            "User registered: {Email}. Verification email sent. Phone OTP {OtpStatus}.", 
            user.Email, smsSent ? "sent" : "failed");

        // Return response WITHOUT tokens - user must verify first
        return new AuthResponse
        {
            AccessToken = null!, // No token until verified
            RefreshToken = null!, // No token until verified
            ExpiresAt = DateTime.UtcNow,
            User = _mapper.Map<UserDto>(user),
            RequiresVerification = true,
            VerificationMessage = "Please verify your email and phone number to complete registration.",
            IsEmailVerified = false,
            IsPhoneVerified = false,
            Email = user.Email,
            PhoneNumber = MaskPhoneNumber(normalizedPhone)
        };
    }

    private static string GenerateOtp()
    {
        var random = new Random();
        return random.Next(100000, 999999).ToString();
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        // Case-insensitive email lookup
        var normalizedEmail = request.Email?.Trim().ToLowerInvariant();
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken);

        if (user == null)
        {
            throw new UnauthorizedAccessException("Invalid email or password");
        }
        
        // Verify password
        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            throw new UnauthorizedAccessException("Invalid email or password");
        }

        // Check if verification is required
        if (!user.IsEmailVerified || !user.IsPhoneVerified)
        {
            var missingVerifications = new List<string>();
            if (!user.IsEmailVerified) missingVerifications.Add("email");
            if (!user.IsPhoneVerified) missingVerifications.Add("phone");
            
            return new AuthResponse
            {
                RequiresVerification = true,
                VerificationMessage = $"Please verify your {string.Join(" and ", missingVerifications)} before logging in.",
                IsEmailVerified = user.IsEmailVerified,
                IsPhoneVerified = user.IsPhoneVerified,
                Email = user.Email
            };
        }

        // Update last login
        user.LastLoginAt = DateTime.UtcNow;

        // Generate tokens
        var accessToken = _tokenService.GenerateAccessToken(user.Id, user.Email, user.Role.ToString());
        var refreshToken = _tokenService.GenerateRefreshToken();

        // Save refresh token
        var refreshTokenEntity = new RefreshToken
        {
            UserId = user.Id,
            Token = refreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };

        _context.RefreshTokens.Add(refreshTokenEntity);
        await _context.SaveChangesAsync(cancellationToken);

        return new AuthResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            User = _mapper.Map<UserDto>(user)
        };
    }

    public async Task<AuthResponse> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var tokenEntity = await _context.RefreshTokens
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.Token == refreshToken && !rt.IsRevoked, cancellationToken);

        if (tokenEntity == null || tokenEntity.ExpiresAt < DateTime.UtcNow)
        {
            throw new UnauthorizedAccessException("Invalid or expired refresh token");
        }

        var user = tokenEntity.User;

        // Generate new tokens
        var accessToken = _tokenService.GenerateAccessToken(user.Id, user.Email, user.Role.ToString());
        var newRefreshToken = _tokenService.GenerateRefreshToken();

        // Revoke old token
        tokenEntity.IsRevoked = true;
        tokenEntity.RevokedAt = DateTime.UtcNow;

        // Save new refresh token
        var newRefreshTokenEntity = new RefreshToken
        {
            UserId = user.Id,
            Token = newRefreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };

        _context.RefreshTokens.Add(newRefreshTokenEntity);
        await _context.SaveChangesAsync(cancellationToken);

        return new AuthResponse
        {
            AccessToken = accessToken,
            RefreshToken = newRefreshToken,
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            User = _mapper.Map<UserDto>(user)
        };
    }

    public async Task RevokeTokenAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var tokenEntity = await _context.RefreshTokens
            .FirstOrDefaultAsync(rt => rt.Token == refreshToken, cancellationToken);

        if (tokenEntity != null && !tokenEntity.IsRevoked)
        {
            tokenEntity.IsRevoked = true;
            tokenEntity.RevokedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<VerificationStatusResponse> GetVerificationStatusAsync(string email, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = email?.Trim().ToLowerInvariant();
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken);

        if (user == null)
        {
            throw new InvalidOperationException("User not found");
        }

        return new VerificationStatusResponse
        {
            Email = user.Email,
            IsEmailVerified = user.IsEmailVerified,
            IsPhoneVerified = user.IsPhoneVerified,
            PhoneNumber = MaskPhoneNumber(user.PhoneNumber)
        };
    }

    private static string GenerateSecureToken()
    {
        var randomBytes = new byte[32];
        using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .Replace("=", "");
    }

    private static string? MaskPhoneNumber(string? phone)
    {
        if (string.IsNullOrEmpty(phone) || phone.Length < 6)
            return null;
        return $"{phone[..3]}****{phone[^3..]}";
    }
}
