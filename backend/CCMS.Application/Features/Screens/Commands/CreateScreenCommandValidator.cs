using FluentValidation;

namespace CCMS.Application.Features.Screens.Commands;

public class CreateScreenCommandValidator : AbstractValidator<CreateScreenCommand>
{
    public CreateScreenCommandValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty()
            .WithMessage("User ID is required.");

        RuleFor(x => x.Request.Name)
            .NotEmpty()
            .WithMessage("Screen name is required.")
            .MaximumLength(200)
            .WithMessage("Screen name must not exceed 200 characters.");

        RuleFor(x => x.Request.Description)
            .MaximumLength(2000)
            .WithMessage("Description must not exceed 2000 characters.");

        RuleFor(x => x.Request.PhysicalWidth)
            .GreaterThan(0)
            .WithMessage("Physical width must be greater than 0.");

        RuleFor(x => x.Request.PhysicalHeight)
            .GreaterThan(0)
            .WithMessage("Physical height must be greater than 0.");

        RuleFor(x => x.Request.ResolutionWidth)
            .GreaterThan(0)
            .WithMessage("Resolution width must be greater than 0.");

        RuleFor(x => x.Request.ResolutionHeight)
            .GreaterThan(0)
            .WithMessage("Resolution height must be greater than 0.");

        RuleFor(x => x.Request.TimeFrameMinutes)
            .GreaterThan(0)
            .WithMessage("Time frame minutes must be greater than 0.");

        RuleFor(x => x.Request.SlotsPerFrame)
            .GreaterThan(0)
            .WithMessage("Slots per frame must be greater than 0.");

        RuleFor(x => x.Request.PricePerSlot)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Price per slot must be greater than or equal to 0.");

        RuleFor(x => x.Request.Currency)
            .NotEmpty()
            .WithMessage("Currency is required.")
            .MaximumLength(10)
            .WithMessage("Currency code must not exceed 10 characters.");

        RuleFor(x => x.Request.Timezone)
            .NotEmpty()
            .WithMessage("Timezone is required.")
            .MaximumLength(100)
            .WithMessage("Timezone must not exceed 100 characters.");

        RuleFor(x => x.Request.DeviceId)
            .MaximumLength(200)
            .WithMessage("Device ID must not exceed 200 characters.");

        RuleFor(x => x.Request.Location)
            .NotNull()
            .WithMessage("Location is required.");

        When(x => x.Request.Location != null, () =>
        {
            RuleFor(x => x.Request.Location.City)
                .NotEmpty()
                .WithMessage("City is required.")
                .MaximumLength(100)
                .WithMessage("City must not exceed 100 characters.");

            RuleFor(x => x.Request.Location.Country)
                .NotEmpty()
                .WithMessage("Country is required.")
                .MaximumLength(100)
                .WithMessage("Country must not exceed 100 characters.");

            RuleFor(x => x.Request.Location.Street)
                .MaximumLength(300)
                .WithMessage("Street must not exceed 300 characters.");

            RuleFor(x => x.Request.Location.State)
                .MaximumLength(100)
                .WithMessage("State must not exceed 100 characters.");

            RuleFor(x => x.Request.Location.PostalCode)
                .MaximumLength(20)
                .WithMessage("Postal code must not exceed 20 characters.");
        });
    }
}
