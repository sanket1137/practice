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

        // Frame time must divide evenly into integer-second slots.
        // E.g., 1 min / 6 slots = 10s ✓   but 1 min / 7 slots = 8.57s ✗
        RuleFor(x => x)
            .Must(x => x.TimeFrameMinutes > 0 && x.SlotsPerFrame > 0
                        && (x.TimeFrameMinutes * 60) % x.SlotsPerFrame == 0)
            .WithMessage(x =>
            {
                var totalSec = x.TimeFrameMinutes * 60;
                var slotSec = totalSec / (double)x.SlotsPerFrame;
                return $"Frame time ({x.TimeFrameMinutes} min = {totalSec}s) must divide evenly by {x.SlotsPerFrame} slots. " +
                       $"Current slot duration would be {slotSec:F2}s — must be a whole number of seconds.";
            })
            .When(x => x.TimeFrameMinutes > 0 && x.SlotsPerFrame > 0);
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

        RuleFor(x => x.SlotsPerFrame)
            .GreaterThan(0).WithMessage("Slots per frame must be greater than 0")
            .When(x => x.SlotsPerFrame.HasValue);

        RuleFor(x => x.TimeFrameMinutes)
            .GreaterThan(0).WithMessage("Time frame must be greater than 0")
            .When(x => x.TimeFrameMinutes.HasValue);

        // When BOTH fields are provided in the update, validate even division.
        // When only one is provided, cross-field validation is done in the handler
        // (because the other value must be read from the existing screen entity).
        RuleFor(x => x)
            .Must(x => (x.TimeFrameMinutes!.Value * 60) % x.SlotsPerFrame!.Value == 0)
            .WithMessage(x =>
            {
                var totalSec = x.TimeFrameMinutes!.Value * 60;
                var slotSec = totalSec / (double)x.SlotsPerFrame!.Value;
                return $"Frame time ({x.TimeFrameMinutes} min = {totalSec}s) must divide evenly by {x.SlotsPerFrame} slots. " +
                       $"Current slot duration would be {slotSec:F2}s — must be a whole number of seconds.";
            })
            .When(x => x.TimeFrameMinutes.HasValue && x.SlotsPerFrame.HasValue);
    }
}
