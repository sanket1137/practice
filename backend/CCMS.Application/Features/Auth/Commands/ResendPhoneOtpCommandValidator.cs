using FluentValidation;

namespace CCMS.Application.Features.Auth.Commands;

public class ResendPhoneOtpCommandValidator : AbstractValidator<ResendPhoneOtpCommand>
{
    public ResendPhoneOtpCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .WithMessage("Email is required.")
            .EmailAddress()
            .WithMessage("A valid email address is required.")
            .MaximumLength(256)
            .WithMessage("Email must not exceed 256 characters.");
    }
}
