using FluentValidation;

namespace CCMS.Application.Features.Auth.Commands;

public class VerifyPhoneOtpCommandValidator : AbstractValidator<VerifyPhoneOtpCommand>
{
    public VerifyPhoneOtpCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .WithMessage("Email is required.")
            .EmailAddress()
            .WithMessage("A valid email address is required.")
            .MaximumLength(256)
            .WithMessage("Email must not exceed 256 characters.");

        RuleFor(x => x.Otp)
            .NotEmpty()
            .WithMessage("OTP is required.")
            .MaximumLength(10)
            .WithMessage("OTP must not exceed 10 characters.");
    }
}
