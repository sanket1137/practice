using Amazon;
using Amazon.SimpleEmail;
using Amazon.SimpleEmail.Model;
using CCMS.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CCMS.Infrastructure.Services;

/// <summary>
/// Email service implementation using AWS SES
/// </summary>
public class EmailService : IEmailService
{
    private readonly IAmazonSimpleEmailService? _sesClient;
    private readonly ILogger<EmailService> _logger;
    private readonly string _fromEmail;
    private readonly string _appBaseUrl;
    private readonly bool _useDevelopmentMode;

    public EmailService(
        IConfiguration configuration,
        ILogger<EmailService> logger)
    {
        _logger = logger;
        
        // Development mode: logs emails instead of sending via AWS SES
        _useDevelopmentMode = configuration.GetValue<bool>("Email:DevelopmentMode", false);
        _appBaseUrl = configuration["App:BaseUrl"] ?? "https://app.pixelspot.in";
        _fromEmail = configuration["AWS:SES:FromEmail"] ?? "noreply@pixelspot.in";

        if (!_useDevelopmentMode)
        {
            var accessKeyId = configuration["AWS:SES:AccessKeyId"] 
                ?? throw new InvalidOperationException("AWS:SES:AccessKeyId not configured");
            var secretAccessKey = configuration["AWS:SES:SecretAccessKey"] 
                ?? throw new InvalidOperationException("AWS:SES:SecretAccessKey not configured");
            var region = configuration["AWS:SES:Region"] ?? "ap-south-1";

            var sesConfig = new AmazonSimpleEmailServiceConfig
            {
                RegionEndpoint = RegionEndpoint.GetBySystemName(region)
            };
            
            _sesClient = new AmazonSimpleEmailServiceClient(accessKeyId, secretAccessKey, sesConfig);
        }
    }

    public async Task<bool> SendVerificationEmailAsync(string email, string firstName, string verificationToken)
    {
        var verificationLink = $"{_appBaseUrl}/verify-email?token={verificationToken}";
        
        var subject = "Verify your PixelSpot account";
        var htmlBody = GetVerificationEmailTemplate(firstName, verificationLink);
        var textBody = $"Hi {firstName},\n\nPlease verify your email by clicking this link: {verificationLink}\n\nThis link expires in 24 hours.\n\nIf you didn't create an account, please ignore this email.\n\nBest regards,\nThe PixelSpot Team";

        return await SendEmailAsync(email, subject, htmlBody, textBody);
    }

    public async Task<bool> SendPasswordResetEmailAsync(string email, string firstName, string resetToken)
    {
        var resetLink = $"{_appBaseUrl}/reset-password?token={resetToken}";
        
        var subject = "Reset your PixelSpot password";
        var htmlBody = GetPasswordResetEmailTemplate(firstName, resetLink);
        var textBody = $"Hi {firstName},\n\nYou requested to reset your password. Click this link to reset it: {resetLink}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe PixelSpot Team";

        return await SendEmailAsync(email, subject, htmlBody, textBody);
    }

    public async Task<bool> SendWelcomeEmailAsync(string email, string firstName)
    {
        var subject = "Welcome to PixelSpot!";
        var htmlBody = GetWelcomeEmailTemplate(firstName);
        var textBody = $"Hi {firstName},\n\nWelcome to PixelSpot! Your account is now verified and ready to use.\n\nGet started by visiting: {_appBaseUrl}/dashboard\n\nBest regards,\nThe PixelSpot Team";

        return await SendEmailAsync(email, subject, htmlBody, textBody);
    }

    public async Task<bool> SendEmailAsync(string to, string subject, string htmlBody, string? textBody = null)
    {
        // Development mode: just log the email
        if (_useDevelopmentMode)
        {
            _logger.LogWarning(
                "[DEVELOPMENT MODE] Email to {Email}:\n  Subject: {Subject}\n  Body Preview: {BodyPreview}",
                to, subject, textBody?.Substring(0, Math.Min(200, textBody?.Length ?? 0)) ?? "HTML only");
            return true;
        }

        if (_sesClient == null)
        {
            _logger.LogError("SES client not initialized. Cannot send email to {Email}", to);
            return false;
        }

        try
        {
            var sendRequest = new SendEmailRequest
            {
                Source = _fromEmail,
                Destination = new Destination
                {
                    ToAddresses = new List<string> { to }
                },
                Message = new Message
                {
                    Subject = new Content(subject),
                    Body = new Body
                    {
                        Html = new Content
                        {
                            Charset = "UTF-8",
                            Data = htmlBody
                        },
                        Text = textBody != null ? new Content
                        {
                            Charset = "UTF-8",
                            Data = textBody
                        } : null
                    }
                }
            };

            var response = await _sesClient.SendEmailAsync(sendRequest);
            
            _logger.LogInformation(
                "Email sent successfully to {Email}. MessageId: {MessageId}", 
                to, response.MessageId);
            
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {Email}", to);
            return false;
        }
    }

    #region Email Templates

    private string GetVerificationEmailTemplate(string firstName, string verificationLink)
    {
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head>
<body style='margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;'>
    <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0'>
        <tr>
            <td align='center' style='padding: 40px 0;'>
                <table role='presentation' width='600' cellspacing='0' cellpadding='0' border='0' style='background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);'>
                    <!-- Header -->
                    <tr>
                        <td style='padding: 40px 40px 20px 40px; text-align: center; background-color: #4F46E5; border-radius: 8px 8px 0 0;'>
                            <h1 style='margin: 0; color: #ffffff; font-size: 28px;'>PixelSpot</h1>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style='padding: 40px;'>
                            <h2 style='margin: 0 0 20px 0; color: #333333; font-size: 24px;'>Verify your email address</h2>
                            <p style='margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;'>
                                Hi {firstName},
                            </p>
                            <p style='margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.5;'>
                                Thanks for signing up for PixelSpot! Please verify your email address by clicking the button below.
                            </p>
                            <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0'>
                                <tr>
                                    <td align='center'>
                                        <a href='{verificationLink}' style='display: inline-block; padding: 14px 40px; background-color: #4F46E5; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 6px;'>
                                            Verify Email Address
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style='margin: 30px 0 0 0; color: #999999; font-size: 14px; line-height: 1.5;'>
                                This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
                            </p>
                            <p style='margin: 20px 0 0 0; color: #999999; font-size: 12px; line-height: 1.5;'>
                                If the button doesn't work, copy and paste this link into your browser:<br>
                                <a href='{verificationLink}' style='color: #4F46E5; word-break: break-all;'>{verificationLink}</a>
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style='padding: 20px 40px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center;'>
                            <p style='margin: 0; color: #999999; font-size: 12px;'>
                                © 2026 PixelSpot. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
    }

    private string GetPasswordResetEmailTemplate(string firstName, string resetLink)
    {
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head>
<body style='margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;'>
    <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0'>
        <tr>
            <td align='center' style='padding: 40px 0;'>
                <table role='presentation' width='600' cellspacing='0' cellpadding='0' border='0' style='background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);'>
                    <!-- Header -->
                    <tr>
                        <td style='padding: 40px 40px 20px 40px; text-align: center; background-color: #4F46E5; border-radius: 8px 8px 0 0;'>
                            <h1 style='margin: 0; color: #ffffff; font-size: 28px;'>PixelSpot</h1>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style='padding: 40px;'>
                            <h2 style='margin: 0 0 20px 0; color: #333333; font-size: 24px;'>Reset your password</h2>
                            <p style='margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;'>
                                Hi {firstName},
                            </p>
                            <p style='margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.5;'>
                                We received a request to reset your password. Click the button below to choose a new password.
                            </p>
                            <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0'>
                                <tr>
                                    <td align='center'>
                                        <a href='{resetLink}' style='display: inline-block; padding: 14px 40px; background-color: #4F46E5; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 6px;'>
                                            Reset Password
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style='margin: 30px 0 0 0; color: #999999; font-size: 14px; line-height: 1.5;'>
                                This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style='padding: 20px 40px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center;'>
                            <p style='margin: 0; color: #999999; font-size: 12px;'>
                                © 2026 PixelSpot. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
    }

    private string GetWelcomeEmailTemplate(string firstName)
    {
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head>
<body style='margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;'>
    <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0'>
        <tr>
            <td align='center' style='padding: 40px 0;'>
                <table role='presentation' width='600' cellspacing='0' cellpadding='0' border='0' style='background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);'>
                    <!-- Header -->
                    <tr>
                        <td style='padding: 40px 40px 20px 40px; text-align: center; background-color: #4F46E5; border-radius: 8px 8px 0 0;'>
                            <h1 style='margin: 0; color: #ffffff; font-size: 28px;'>🎉 Welcome to PixelSpot!</h1>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style='padding: 40px;'>
                            <h2 style='margin: 0 0 20px 0; color: #333333; font-size: 24px;'>Your account is ready!</h2>
                            <p style='margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;'>
                                Hi {firstName},
                            </p>
                            <p style='margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.5;'>
                                Your email has been verified and your PixelSpot account is now active. You're all set to start managing your digital signage!
                            </p>
                            <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0'>
                                <tr>
                                    <td align='center'>
                                        <a href='{_appBaseUrl}/dashboard' style='display: inline-block; padding: 14px 40px; background-color: #4F46E5; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 6px;'>
                                            Go to Dashboard
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style='margin: 30px 0 0 0; color: #666666; font-size: 14px; line-height: 1.5;'>
                                <strong>Quick start tips:</strong>
                            </p>
                            <ul style='color: #666666; font-size: 14px; line-height: 1.8;'>
                                <li>Add your first screen to start displaying content</li>
                                <li>Create a campaign to organize your ads</li>
                                <li>Upload creatives and book screen slots</li>
                            </ul>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style='padding: 20px 40px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center;'>
                            <p style='margin: 0; color: #999999; font-size: 12px;'>
                                © 2026 PixelSpot. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
    }

    public async Task<bool> SendBookingApprovedEmailAsync(
        string email, 
        string firstName, 
        Guid bookingId,
        string campaignName,
        string screenName,
        DateTime startDate,
        DateTime endDate,
        decimal totalPrice,
        string currency)
    {
        var bookingLink = $"{_appBaseUrl}/bookings/{bookingId}";
        var subject = $"🎉 Booking Approved - {campaignName}";
        var htmlBody = GetBookingApprovedEmailTemplate(firstName, campaignName, screenName, startDate, endDate, totalPrice, currency, bookingLink);
        var textBody = $"Hi {firstName},\n\nGreat news! Your booking for '{campaignName}' on screen '{screenName}' has been approved!\n\n" +
                      $"Period: {startDate:MMM dd, yyyy} to {endDate:MMM dd, yyyy}\n" +
                      $"Total: {currency} {totalPrice:N2}\n\n" +
                      $"Your ad will start displaying on the scheduled date.\n\n" +
                      $"View details: {bookingLink}\n\n" +
                      $"Best regards,\nThe PixelSpot Team";

        return await SendEmailAsync(email, subject, htmlBody, textBody);
    }

    public async Task<bool> SendBookingRejectedEmailAsync(
        string email, 
        string firstName, 
        Guid bookingId,
        string campaignName,
        string screenName,
        string? rejectionReason)
    {
        var dashboardLink = $"{_appBaseUrl}/bookings";
        var subject = $"Booking Update - {campaignName}";
        var htmlBody = GetBookingRejectedEmailTemplate(firstName, campaignName, screenName, rejectionReason, dashboardLink);
        var textBody = $"Hi {firstName},\n\nUnfortunately, your booking for '{campaignName}' on screen '{screenName}' was not approved.\n\n" +
                      (string.IsNullOrEmpty(rejectionReason) ? "" : $"Reason: {rejectionReason}\n\n") +
                      $"You can browse other available screens or modify your booking request.\n\n" +
                      $"View other options: {dashboardLink}\n\n" +
                      $"Best regards,\nThe PixelSpot Team";

        return await SendEmailAsync(email, subject, htmlBody, textBody);
    }

    public async Task<bool> SendNewBookingRequestEmailAsync(
        string email, 
        string firstName,
        Guid bookingId,
        string screenName,
        string advertiserName,
        string campaignName,
        DateTime startDate,
        DateTime endDate)
    {
        var bookingLink = $"{_appBaseUrl}/bookings/{bookingId}";
        var subject = $"📋 New Booking Request - {screenName}";
        var htmlBody = GetNewBookingRequestEmailTemplate(firstName, screenName, advertiserName, campaignName, startDate, endDate, bookingLink);
        var textBody = $"Hi {firstName},\n\nYou have a new booking request for your screen '{screenName}'!\n\n" +
                      $"Advertiser: {advertiserName}\n" +
                      $"Campaign: {campaignName}\n" +
                      $"Period: {startDate:MMM dd, yyyy} to {endDate:MMM dd, yyyy}\n\n" +
                      $"Review and respond: {bookingLink}\n\n" +
                      $"Best regards,\nThe PixelSpot Team";

        return await SendEmailAsync(email, subject, htmlBody, textBody);
    }

    private string GetBookingApprovedEmailTemplate(string firstName, string campaignName, string screenName, DateTime startDate, DateTime endDate, decimal totalPrice, string currency, string bookingLink)
    {
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head>
<body style='margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;'>
    <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0'>
        <tr>
            <td align='center' style='padding: 40px 0;'>
                <table role='presentation' width='600' cellspacing='0' cellpadding='0' border='0' style='background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);'>
                    <tr>
                        <td style='padding: 40px 40px 20px 40px; text-align: center; background-color: #10B981; border-radius: 8px 8px 0 0;'>
                            <h1 style='margin: 0; color: #ffffff; font-size: 28px;'>🎉 Booking Approved!</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style='padding: 40px;'>
                            <p style='margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;'>
                                Hi {firstName},
                            </p>
                            <p style='margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;'>
                                Great news! Your booking has been approved and your ad is scheduled to go live.
                            </p>
                            <table style='width: 100%; border-collapse: collapse; margin: 20px 0;'>
                                <tr>
                                    <td style='padding: 12px; background-color: #f8f8f8; border-bottom: 1px solid #eee;'><strong>Campaign</strong></td>
                                    <td style='padding: 12px; background-color: #f8f8f8; border-bottom: 1px solid #eee;'>{campaignName}</td>
                                </tr>
                                <tr>
                                    <td style='padding: 12px; border-bottom: 1px solid #eee;'><strong>Screen</strong></td>
                                    <td style='padding: 12px; border-bottom: 1px solid #eee;'>{screenName}</td>
                                </tr>
                                <tr>
                                    <td style='padding: 12px; background-color: #f8f8f8; border-bottom: 1px solid #eee;'><strong>Start Date</strong></td>
                                    <td style='padding: 12px; background-color: #f8f8f8; border-bottom: 1px solid #eee;'>{startDate:MMMM dd, yyyy}</td>
                                </tr>
                                <tr>
                                    <td style='padding: 12px; border-bottom: 1px solid #eee;'><strong>End Date</strong></td>
                                    <td style='padding: 12px; border-bottom: 1px solid #eee;'>{endDate:MMMM dd, yyyy}</td>
                                </tr>
                                <tr>
                                    <td style='padding: 12px; background-color: #f8f8f8;'><strong>Total</strong></td>
                                    <td style='padding: 12px; background-color: #f8f8f8; font-weight: bold; color: #10B981;'>{currency} {totalPrice:N2}</td>
                                </tr>
                            </table>
                            <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0'>
                                <tr>
                                    <td align='center' style='padding-top: 20px;'>
                                        <a href='{bookingLink}' style='display: inline-block; padding: 14px 40px; background-color: #4F46E5; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 6px;'>
                                            View Booking Details
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style='padding: 20px 40px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center;'>
                            <p style='margin: 0; color: #999999; font-size: 12px;'>© 2026 PixelSpot. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
    }

    private string GetBookingRejectedEmailTemplate(string firstName, string campaignName, string screenName, string? rejectionReason, string dashboardLink)
    {
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head>
<body style='margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;'>
    <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0'>
        <tr>
            <td align='center' style='padding: 40px 0;'>
                <table role='presentation' width='600' cellspacing='0' cellpadding='0' border='0' style='background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);'>
                    <tr>
                        <td style='padding: 40px 40px 20px 40px; text-align: center; background-color: #F59E0B; border-radius: 8px 8px 0 0;'>
                            <h1 style='margin: 0; color: #ffffff; font-size: 28px;'>Booking Update</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style='padding: 40px;'>
                            <p style='margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;'>
                                Hi {firstName},
                            </p>
                            <p style='margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;'>
                                Unfortunately, your booking request for <strong>{campaignName}</strong> on screen <strong>{screenName}</strong> was not approved.
                            </p>
                            {(string.IsNullOrEmpty(rejectionReason) ? "" : $@"
                            <div style='background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;'>
                                <p style='margin: 0; color: #92400E; font-size: 14px;'>
                                    <strong>Reason:</strong> {rejectionReason}
                                </p>
                            </div>
                            ")}
                            <p style='margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;'>
                                Don't worry! There are many other screens available that might be a perfect fit for your campaign.
                            </p>
                            <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0'>
                                <tr>
                                    <td align='center' style='padding-top: 20px;'>
                                        <a href='{dashboardLink}' style='display: inline-block; padding: 14px 40px; background-color: #4F46E5; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 6px;'>
                                            Browse Screens
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style='padding: 20px 40px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center;'>
                            <p style='margin: 0; color: #999999; font-size: 12px;'>© 2026 PixelSpot. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
    }

    private string GetNewBookingRequestEmailTemplate(string firstName, string screenName, string advertiserName, string campaignName, DateTime startDate, DateTime endDate, string bookingLink)
    {
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head>
<body style='margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;'>
    <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0'>
        <tr>
            <td align='center' style='padding: 40px 0;'>
                <table role='presentation' width='600' cellspacing='0' cellpadding='0' border='0' style='background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);'>
                    <tr>
                        <td style='padding: 40px 40px 20px 40px; text-align: center; background-color: #3B82F6; border-radius: 8px 8px 0 0;'>
                            <h1 style='margin: 0; color: #ffffff; font-size: 28px;'>📋 New Booking Request</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style='padding: 40px;'>
                            <p style='margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;'>
                                Hi {firstName},
                            </p>
                            <p style='margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;'>
                                You have received a new booking request for your screen <strong>{screenName}</strong>.
                            </p>
                            <table style='width: 100%; border-collapse: collapse; margin: 20px 0;'>
                                <tr>
                                    <td style='padding: 12px; background-color: #f8f8f8; border-bottom: 1px solid #eee;'><strong>Advertiser</strong></td>
                                    <td style='padding: 12px; background-color: #f8f8f8; border-bottom: 1px solid #eee;'>{advertiserName}</td>
                                </tr>
                                <tr>
                                    <td style='padding: 12px; border-bottom: 1px solid #eee;'><strong>Campaign</strong></td>
                                    <td style='padding: 12px; border-bottom: 1px solid #eee;'>{campaignName}</td>
                                </tr>
                                <tr>
                                    <td style='padding: 12px; background-color: #f8f8f8; border-bottom: 1px solid #eee;'><strong>Start Date</strong></td>
                                    <td style='padding: 12px; background-color: #f8f8f8; border-bottom: 1px solid #eee;'>{startDate:MMMM dd, yyyy}</td>
                                </tr>
                                <tr>
                                    <td style='padding: 12px;'><strong>End Date</strong></td>
                                    <td style='padding: 12px;'>{endDate:MMMM dd, yyyy}</td>
                                </tr>
                            </table>
                            <p style='margin: 0 0 20px 0; color: #666666; font-size: 14px; line-height: 1.5;'>
                                Please review the request and approve or reject it at your earliest convenience.
                            </p>
                            <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0'>
                                <tr>
                                    <td align='center' style='padding-top: 20px;'>
                                        <a href='{bookingLink}' style='display: inline-block; padding: 14px 40px; background-color: #4F46E5; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 6px;'>
                                            Review Booking Request
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style='padding: 20px 40px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center;'>
                            <p style='margin: 0; color: #999999; font-size: 12px;'>© 2026 PixelSpot. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
    }

    #endregion
}
