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

    /// <summary>
    /// Send email notification when a booking is approved
    /// </summary>
    /// <param name="email">Advertiser's email address</param>
    /// <param name="firstName">Advertiser's first name</param>
    /// <param name="bookingId">The booking ID</param>
    /// <param name="campaignName">Name of the campaign</param>
    /// <param name="screenName">Name of the screen</param>
    /// <param name="startDate">Booking start date</param>
    /// <param name="endDate">Booking end date</param>
    /// <param name="totalPrice">Total booking price</param>
    /// <param name="currency">Currency code</param>
    /// <returns>True if email sent successfully</returns>
    Task<bool> SendBookingApprovedEmailAsync(
        string email, 
        string firstName, 
        Guid bookingId,
        string campaignName,
        string screenName,
        DateTime startDate,
        DateTime endDate,
        decimal totalPrice,
        string currency);

    /// <summary>
    /// Send email notification when a booking is rejected
    /// </summary>
    /// <param name="email">Advertiser's email address</param>
    /// <param name="firstName">Advertiser's first name</param>
    /// <param name="bookingId">The booking ID</param>
    /// <param name="campaignName">Name of the campaign</param>
    /// <param name="screenName">Name of the screen</param>
    /// <param name="rejectionReason">Reason for rejection (optional)</param>
    /// <returns>True if email sent successfully</returns>
    Task<bool> SendBookingRejectedEmailAsync(
        string email, 
        string firstName, 
        Guid bookingId,
        string campaignName,
        string screenName,
        string? rejectionReason);

    /// <summary>
    /// Send email notification when a booking is cancelled
    /// </summary>
    Task<bool> SendBookingCancelledEmailAsync(
        string email, 
        string firstName, 
        Guid bookingId,
        string campaignName,
        string screenName,
        string? cancellationReason);

    /// <summary>
    /// Send email notification to screen owner when a new booking request is received
    /// </summary>
    /// <param name="email">Screen owner's email address</param>
    /// <param name="firstName">Screen owner's first name</param>
    /// <param name="bookingId">The booking ID</param>
    /// <param name="screenName">Name of the screen</param>
    /// <param name="advertiserName">Name of the advertiser</param>
    /// <param name="campaignName">Name of the campaign</param>
    /// <param name="startDate">Booking start date</param>
    /// <param name="endDate">Booking end date</param>
    /// <returns>True if email sent successfully</returns>
    Task<bool> SendNewBookingRequestEmailAsync(
        string email, 
        string firstName,
        Guid bookingId,
        string screenName,
        string advertiserName,
        string campaignName,
        DateTime startDate,
        DateTime endDate);
}
