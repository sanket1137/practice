using FluentValidation;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Validators;

public class CreateScreenDtoValidator : AbstractValidator<CreateScreenDto>
{
    public CreateScreenDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Screen name is required")
            .MaximumLength(200).WithMessage("Screen name cannot exceed 200 characters");

        RuleFor(x => x.DeviceId)
            .MaximumLength(100).WithMessage("Device ID cannot exceed 100 characters");

        RuleFor(x => x.OperatingHours)
            .NotEmpty().WithMessage("Operating hours are required")
            .Matches(@"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
            .WithMessage("Operating hours must be in 24-hour format (HH:MM-HH:MM). Example: 09:00-17:00");

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

        RuleFor(x => x.TimeFrame)
            .GreaterThan(0).WithMessage("Time frame must be greater than 0");
    }
}

public class UpdateScreenDtoValidator : AbstractValidator<UpdateScreenDto>
{
    public UpdateScreenDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Screen name is required")
            .MaximumLength(200).WithMessage("Screen name cannot exceed 200 characters");

        RuleFor(x => x.OperatingHours)
            .NotEmpty().WithMessage("Operating hours are required")
            .Matches(@"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
            .WithMessage("Operating hours must be in 24-hour format (HH:MM-HH:MM). Example: 09:00-17:00");

        RuleFor(x => x.PricePerSlot)
            .GreaterThanOrEqualTo(0).WithMessage("Price per slot cannot be negative");

        RuleFor(x => x.Currency)
            .NotEmpty().WithMessage("Currency is required")
            .Length(3).WithMessage("Currency must be a 3-letter code (e.g., USD, EUR)");
    }
}
