using FluentValidation;

namespace CCMS.Application.Features.Screens.Commands;

public class UpdateScreenCommandValidator : AbstractValidator<UpdateScreenCommand>
{
    public UpdateScreenCommandValidator()
    {
        RuleFor(x => x.ScreenId)
            .NotEmpty()
            .WithMessage("Screen ID is required.");

        RuleFor(x => x.UserId)
            .NotEmpty()
            .WithMessage("User ID is required.");

        RuleFor(x => x.Request.Name)
            .NotEmpty()
            .WithMessage("Screen name cannot be empty.")
            .MaximumLength(200)
            .WithMessage("Screen name must not exceed 200 characters.")
            .When(x => x.Request.Name != null);

        RuleFor(x => x.Request.Description)
            .MaximumLength(2000)
            .WithMessage("Description must not exceed 2000 characters.")
            .When(x => x.Request.Description != null);

        RuleFor(x => x.Request.PhysicalWidth)
            .GreaterThan(0)
            .WithMessage("Physical width must be greater than 0.")
            .When(x => x.Request.PhysicalWidth.HasValue);

        RuleFor(x => x.Request.PhysicalHeight)
            .GreaterThan(0)
            .WithMessage("Physical height must be greater than 0.")
            .When(x => x.Request.PhysicalHeight.HasValue);

        RuleFor(x => x.Request.ResolutionWidth)
            .GreaterThan(0)
            .WithMessage("Resolution width must be greater than 0.")
            .When(x => x.Request.ResolutionWidth.HasValue);

        RuleFor(x => x.Request.ResolutionHeight)
            .GreaterThan(0)
            .WithMessage("Resolution height must be greater than 0.")
            .When(x => x.Request.ResolutionHeight.HasValue);

        RuleFor(x => x.Request.TimeFrameMinutes)
            .GreaterThan(0)
            .WithMessage("Time frame minutes must be greater than 0.")
            .When(x => x.Request.TimeFrameMinutes.HasValue);

        RuleFor(x => x.Request.SlotsPerFrame)
            .GreaterThan(0)
            .WithMessage("Slots per frame must be greater than 0.")
            .When(x => x.Request.SlotsPerFrame.HasValue);

        RuleFor(x => x.Request.PricePerSlot)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Price per slot must be greater than or equal to 0.")
            .When(x => x.Request.PricePerSlot.HasValue);

        RuleFor(x => x.Request.Status)
            .MaximumLength(50)
            .WithMessage("Status must not exceed 50 characters.")
            .When(x => x.Request.Status != null);

        RuleFor(x => x.Request.Timezone)
            .MaximumLength(100)
            .WithMessage("Timezone must not exceed 100 characters.")
            .When(x => x.Request.Timezone != null);

        When(x => x.Request.Location != null, () =>
        {
            RuleFor(x => x.Request.Location!.City)
                .NotEmpty()
                .WithMessage("City is required.")
                .MaximumLength(100)
                .WithMessage("City must not exceed 100 characters.");

            RuleFor(x => x.Request.Location!.Country)
                .NotEmpty()
                .WithMessage("Country is required.")
                .MaximumLength(100)
                .WithMessage("Country must not exceed 100 characters.");

            RuleFor(x => x.Request.Location!.Street)
                .MaximumLength(300)
                .WithMessage("Street must not exceed 300 characters.");

            RuleFor(x => x.Request.Location!.State)
                .MaximumLength(100)
                .WithMessage("State must not exceed 100 characters.");

            RuleFor(x => x.Request.Location!.PostalCode)
                .MaximumLength(20)
                .WithMessage("Postal code must not exceed 20 characters.");
        });
    }
}
