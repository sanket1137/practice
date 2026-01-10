using MediatR;

namespace CCMS.Application.Features.Auth.Commands;

/// <summary>
/// Command to resend OTP to user's phone using email to lookup phone number
/// Used when user already registered and we have phone on file
/// Rate limited: max 5 OTPs per phone per hour
/// </summary>
public record ResendPhoneOtpCommand(string Email) : IRequest<SendPhoneOtpResult>;
