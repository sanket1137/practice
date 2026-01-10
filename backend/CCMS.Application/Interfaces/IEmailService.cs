namespace CCMS.Application.Interfaces;

/// <summary>
/// Service for sending emails via AWS SES
/// </summary>
public interface IEmailService
{
    /// <summary>
    /// Send email verification link to user
    /// </summary>
    /// <param name="email">Recipient email address</param>
    /// <param name="firstName">User's first name for personalization</param>
    /// <param name="verificationToken">Token to include in verification link</param>
    /// <returns>True if email sent successfully</returns>
    Task<bool> SendVerificationEmailAsync(string email, string firstName, string verificationToken);
    
    /// <summary>
    /// Send password reset email with reset link
    /// </summary>
    /// <param name="email">Recipient email address</param>
    /// <param name="firstName">User's first name for personalization</param>
    /// <param name="resetToken">Token to include in reset link</param>
    /// <returns>True if email sent successfully</returns>
    Task<bool> SendPasswordResetEmailAsync(string email, string firstName, string resetToken);
    
    /// <summary>
    /// Send generic email with custom subject and body
    /// </summary>
    /// <param name="to">Recipient email address</param>
    /// <param name="subject">Email subject</param>
    /// <param name="htmlBody">HTML body content</param>
    /// <param name="textBody">Plain text body content (fallback)</param>
    /// <returns>True if email sent successfully</returns>
    Task<bool> SendEmailAsync(string to, string subject, string htmlBody, string? textBody = null);
    
    /// <summary>
    /// Send welcome email after successful verification
    /// </summary>
    /// <param name="email">Recipient email address</param>
    /// <param name="firstName">User's first name</param>
    /// <returns>True if email sent successfully</returns>
    Task<bool> SendWelcomeEmailAsync(string email, string firstName);
}
