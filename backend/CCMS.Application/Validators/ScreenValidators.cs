using FluentValidation;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Validators;

public class CreateScreenRequestValidator : AbstractValidator<CreateScreenRequest>
{
    public CreateScreenRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Screen name is required")
            .MaximumLength(200).WithMessage("Screen name cannot exceed 200 characters");

        RuleFor(x => x.DeviceId)
            .MaximumLength(100).WithMessage("Device ID cannot exceed 100 characters");

        RuleFor(x => x.Schedule)
            .NotNull().WithMessage("Operating schedule is required");

        RuleFor(x => x.ResolutionWidth)
            .GreaterThan(0).WithMessage("Resolution width must be greater than 0");

        RuleFor(x => x.ResolutionHeight)
            .GreaterThan(0).WithMessage("Resolution height must be greater than 0");

        RuleFor(x => x.PricePerSlot)
            .GreaterThanOrEqualTo(0).WithMessage("Price per slot cannot be negative");

        RuleFor(x => x.Currency)
            .NotEmpty().WithMessage("Currency is required")
            .Length(3).WithMessage("Currency must be a 3-letter code (e.g., USD, EUR)");

        RuleFor(x => x.SlotsPerFrame)
            .GreaterThan(0).WithMessage("Slots per frame must be greater than 0");

        RuleFor(x => x.TimeFrameMinutes)
            .GreaterThan(0).WithMessage("Time frame must be greater than 0");
    }
}

public class UpdateScreenRequestValidator : AbstractValidator<UpdateScreenRequest>
{
    public UpdateScreenRequestValidator()
    {
        RuleFor(x => x.Name)
            .MaximumLength(200).WithMessage("Screen name cannot exceed 200 characters")
            .When(x => x.Name != null);

        RuleFor(x => x.PricePerSlot)
            .GreaterThanOrEqualTo(0).WithMessage("Price per slot cannot be negative")
            .When(x => x.PricePerSlot.HasValue);
    }
}
