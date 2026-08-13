using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using CCMS.Application.Interfaces;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Auth;
using MediatR;
using CCMS.Application.Features.Auth.Commands;
using CCMS.Api.Extensions;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[EnableRateLimiting(RateLimitingExtensions.AuthPolicy)]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IMediator _mediator;
    private readonly IEmailService _emailService;
    private readonly ILogger<AuthController> _logger;
    private readonly IWebHostEnvironment _environment;

    // Refresh tokens live in an HttpOnly cookie, never in the JSON response body —
    // that keeps them out of localStorage/sessionStorage, so an XSS payload that can
    // read JS-accessible storage still can't steal a long-lived credential. Scoped to
    // the auth route prefix so it isn't sent on every unrelated API request.
    private const string RefreshTokenCookieName = "refreshToken";
    private const string RefreshTokenCookiePath = "/api/v1/auth";

    public AuthController(IAuthService authService, IMediator mediator, IEmailService emailService, ILogger<AuthController> logger, IWebHostEnvironment environment)
    {
        _authService = authService;
        _mediator = mediator;
        _emailService = emailService;
        _logger = logger;
        _environment = environment;
    }

    private void SetRefreshTokenCookie(string refreshToken)
    {
        Response.Cookies.Append(RefreshTokenCookieName, refreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = !_environment.IsDevelopment(),
            SameSite = SameSiteMode.Strict,
            Path = RefreshTokenCookiePath,
            Expires = DateTimeOffset.UtcNow.AddDays(7)
        });
    }

    private void ClearRefreshTokenCookie()
    {
        Response.Cookies.Delete(RefreshTokenCookieName, new CookieOptions { Path = RefreshTokenCookiePath });
    }

    /// <summary>
    /// Moves the refresh token from an AuthResponse body into the HttpOnly cookie and
    /// strips it from the body, so it never lands in a JS-readable response.
    /// </summary>
    private AuthResponse IssueViaCookie(AuthResponse result)
    {
        if (!string.IsNullOrEmpty(result.RefreshToken))
        {
            SetRefreshTokenCookie(result.RefreshToken);
            result.RefreshToken = string.Empty;
        }
        return result;
    }

    private string? ResolveRefreshToken(RefreshTokenRequest? request)
    {
        if (!string.IsNullOrEmpty(request?.RefreshToken))
        {
            return request.RefreshToken;
        }
        return Request.Cookies.TryGetValue(RefreshTokenCookieName, out var cookieToken) ? cookieToken : null;
    }

    [HttpPost("register")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Register([FromBody] RegisterRequest request)
    {
        try
        {
            var result = await _authService.RegisterAsync(request);
            return Ok(ApiResponse<AuthResponse>.SuccessResponse(result, "Registration successful"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<AuthResponse>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Registration failed for email {Email}", request.Email);
            return StatusCode(500, ApiResponse<AuthResponse>.ErrorResponse("Registration failed."));
        }
    }

    [HttpPost("login")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Login([FromBody] LoginRequest request)
    {
        try
        {
            var result = await _authService.LoginAsync(request);

            // Check if verification is required
            if (result.RequiresVerification)
            {
                return Ok(ApiResponse<AuthResponse>.SuccessResponse(result, result.VerificationMessage));
            }

            return Ok(ApiResponse<AuthResponse>.SuccessResponse(IssueViaCookie(result), "Login successful"));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(ApiResponse<AuthResponse>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Login failed for email {Email}", request.Email);
            return StatusCode(500, ApiResponse<AuthResponse>.ErrorResponse("Login failed."));
        }
    }

    [HttpPost("refresh")]
    [DisableRateLimiting]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Refresh([FromBody] RefreshTokenRequest? request)
    {
        var token = ResolveRefreshToken(request);
        if (string.IsNullOrEmpty(token))
        {
            return Unauthorized(ApiResponse<AuthResponse>.ErrorResponse("No refresh token provided."));
        }

        try
        {
            var result = await _authService.RefreshTokenAsync(token);
            return Ok(ApiResponse<AuthResponse>.SuccessResponse(IssueViaCookie(result), "Token refreshed successfully"));
        }
        catch (UnauthorizedAccessException ex)
        {
            ClearRefreshTokenCookie();
            return Unauthorized(ApiResponse<AuthResponse>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Token refresh failed");
            return StatusCode(500, ApiResponse<AuthResponse>.ErrorResponse("Token refresh failed."));
        }
    }

    [HttpPost("revoke")]
    public async Task<ActionResult<ApiResponse<object>>> Revoke([FromBody] RefreshTokenRequest? request)
    {
        var token = ResolveRefreshToken(request);
        try
        {
            if (!string.IsNullOrEmpty(token))
            {
                await _authService.RevokeTokenAsync(token);
            }
            return Ok(ApiResponse<object>.SuccessResponse(null, "Token revoked successfully"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Token revocation failed");
            return StatusCode(500, ApiResponse<object>.ErrorResponse("Token revocation failed."));
        }
        finally
        {
            ClearRefreshTokenCookie();
        }
    }

    [HttpPost("request-password-reset")]
    public async Task<ActionResult<ApiResponse<object>>> RequestPasswordReset([FromBody] RequestPasswordResetCommand command)
    {
        try
        {
            await _mediator.Send(command);
            return Ok(ApiResponse<object>.SuccessResponse(null, "If the email exists, a password reset link has been sent."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Password reset request failed");
            return StatusCode(500, ApiResponse<object>.ErrorResponse("Password reset request failed."));
        }
    }

    [HttpPost("reset-password")]
    public async Task<ActionResult<ApiResponse<object>>> ResetPassword([FromBody] ResetPasswordCommand command)
    {
        try
        {
            await _mediator.Send(command);
            return Ok(ApiResponse<object>.SuccessResponse(null, "Password has been reset successfully. You can now log in with your new password."));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(ApiResponse<object>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Password reset failed");
            return StatusCode(500, ApiResponse<object>.ErrorResponse("Password reset failed."));
        }
    }

    #region Email Verification

    /// <summary>
    /// Send email verification link to user
    /// </summary>
    [HttpPost("send-email-verification")]
    public async Task<ActionResult<ApiResponse<SendEmailVerificationResult>>> SendEmailVerification(
        [FromBody] SendEmailVerificationRequest request)
    {
        try
        {
            var result = await _mediator.Send(new SendEmailVerificationCommand(request.Email));
            
            if (!result.Success)
                return BadRequest(ApiResponse<SendEmailVerificationResult>.ErrorResponse(result.Message!));
            
            return Ok(ApiResponse<SendEmailVerificationResult>.SuccessResponse(
                result, "Verification email sent. Please check your inbox."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send verification email for {Email}", request.Email);
            return StatusCode(500, ApiResponse<SendEmailVerificationResult>.ErrorResponse(
                "Failed to send verification email."));
        }
    }

    /// <summary>
    /// Verify email using token from verification link
    /// </summary>
    [HttpPost("verify-email")]
    public async Task<ActionResult<ApiResponse<VerifyEmailResult>>> VerifyEmail(
        [FromBody] VerifyEmailRequest request)
    {
        try
        {
            var result = await _mediator.Send(new VerifyEmailCommand(request.Token));
            
            if (!result.Success)
                return BadRequest(ApiResponse<VerifyEmailResult>.ErrorResponse(result.Message!));
            
            string message;
            if (result.IsFullyVerified)
            {
                message = "Email verified! Your account is now fully verified. You can now login.";
            }
            else
            {
                message = "Email verified successfully. Please also verify your phone number to complete registration.";
            }
            
            return Ok(ApiResponse<VerifyEmailResult>.SuccessResponse(result, message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Email verification failed");
            return StatusCode(500, ApiResponse<VerifyEmailResult>.ErrorResponse(
                "Email verification failed."));
        }
    }

    #endregion

    #region Phone Verification

    /// <summary>
    /// Send OTP to user's phone number
    /// Rate limited: max 5 OTPs per phone per hour
    /// </summary>
    [HttpPost("send-phone-otp")]
    public async Task<ActionResult<ApiResponse<SendPhoneOtpResult>>> SendPhoneOtp(
        [FromBody] SendPhoneOtpRequest request)
    {
        try
        {
            var result = await _mediator.Send(new SendPhoneOtpCommand(request.Email, request.PhoneNumber));
            
            if (!result.Success)
                return BadRequest(ApiResponse<SendPhoneOtpResult>.ErrorResponse(result.Message!));
            
            return Ok(ApiResponse<SendPhoneOtpResult>.SuccessResponse(
                result, "OTP sent to your phone."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send phone OTP for {Email}", request.Email);
            return StatusCode(500, ApiResponse<SendPhoneOtpResult>.ErrorResponse(
                "Failed to send OTP."));
        }
    }

    /// <summary>
    /// Resend OTP to user's phone number using email to lookup phone
    /// Rate limited: max 5 OTPs per phone per hour
    /// </summary>
    [HttpPost("resend-phone-otp")]
    public async Task<ActionResult<ApiResponse<SendPhoneOtpResult>>> ResendPhoneOtp(
        [FromBody] ResendPhoneOtpRequest request)
    {
        try
        {
            var result = await _mediator.Send(new ResendPhoneOtpCommand(request.Email));
            
            if (!result.Success)
                return BadRequest(ApiResponse<SendPhoneOtpResult>.ErrorResponse(result.Message!));
            
            return Ok(ApiResponse<SendPhoneOtpResult>.SuccessResponse(
                result, "OTP resent to your phone."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to resend phone OTP for {Email}", request.Email);
            return StatusCode(500, ApiResponse<SendPhoneOtpResult>.ErrorResponse(
                "Failed to resend OTP."));
        }
    }

    /// <summary>
    /// Verify phone using OTP
    /// Max 3 attempts per OTP
    /// </summary>
    [HttpPost("verify-phone")]
    public async Task<ActionResult<ApiResponse<VerifyPhoneOtpResult>>> VerifyPhone(
        [FromBody] VerifyPhoneOtpRequest request)
    {
        try
        {
            var result = await _mediator.Send(new VerifyPhoneOtpCommand(request.Email, request.Otp));
            
            if (!result.Success)
                return BadRequest(ApiResponse<VerifyPhoneOtpResult>.ErrorResponse(result.Message!));
            
            string message;
            if (result.IsFullyVerified)
            {
                message = "Phone verified! Your account is now fully verified. You can now login.";
            }
            else
            {
                message = "Phone verified successfully. Please also verify your email to complete registration. Check your inbox for the verification link.";
            }
            
            return Ok(ApiResponse<VerifyPhoneOtpResult>.SuccessResponse(result, message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Phone verification failed for {Email}", request.Email);
            return StatusCode(500, ApiResponse<VerifyPhoneOtpResult>.ErrorResponse(
                "Phone verification failed."));
        }
    }

    /// <summary>
    /// Check verification status for a user
    /// </summary>
    [HttpGet("verification-status/{email}")]
    public async Task<ActionResult<ApiResponse<VerificationStatusResponse>>> GetVerificationStatus(string email)
    {
        try
        {
            var status = await _authService.GetVerificationStatusAsync(email);
            return Ok(ApiResponse<VerificationStatusResponse>.SuccessResponse(status));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get verification status for {Email}", email);
            return StatusCode(500, ApiResponse<VerificationStatusResponse>.ErrorResponse(
                "Failed to get verification status."));
        }
    }

    /// <summary>
    /// Complete verification and auto-login after both email and phone are verified
    /// </summary>
    [HttpPost("complete-verification")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> CompleteVerification(
        [FromBody] CompleteVerificationRequest request)
    {
        try
        {
            var result = await _authService.CompleteVerificationAsync(request.Email);
            return Ok(ApiResponse<AuthResponse>.SuccessResponse(IssueViaCookie(result), "Verification complete. Welcome!"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<AuthResponse>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Auto-login failed for {Email}", request.Email);
            return StatusCode(500, ApiResponse<AuthResponse>.ErrorResponse(
                "Auto-login failed."));
        }
    }

    #endregion

    #region Test Endpoints (Development Only)

    /// <summary>
    /// Test email sending - Development only
    /// </summary>
    [HttpPost("test-email")]
    public async Task<ActionResult<ApiResponse<object>>> TestEmail([FromBody] TestEmailRequest request)
    {
        try
        {
            var result = await _emailService.SendEmailAsync(
                request.Email,
                "PixelSpot Test Email",
                "<h1>Test Email</h1><p>This is a test email from PixelSpot CCMS.</p><p>If you received this, email sending is working correctly!</p>",
                "Test Email\n\nThis is a test email from PixelSpot CCMS.\n\nIf you received this, email sending is working correctly!"
            );

            if (result)
            {
                return Ok(ApiResponse<object>.SuccessResponse(
                    new { sent = true, email = request.Email },
                    $"Test email sent successfully to {request.Email}"));
            }
            else
            {
                return BadRequest(ApiResponse<object>.ErrorResponse(
                    $"Failed to send test email to {request.Email}. Check server logs for details."));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending test email to {Email}", request.Email);
            return StatusCode(500, ApiResponse<object>.ErrorResponse(
                "Error sending test email."));
        }
    }

    #endregion
}

// Request DTOs for verification endpoints
public record SendEmailVerificationRequest(string Email);
public record VerifyEmailRequest(string Token);
public record SendPhoneOtpRequest(string Email, string PhoneNumber);
public record ResendPhoneOtpRequest(string Email);
public record VerifyPhoneOtpRequest(string Email, string Otp);
public record CompleteVerificationRequest(string Email);
public record TestEmailRequest(string Email);
