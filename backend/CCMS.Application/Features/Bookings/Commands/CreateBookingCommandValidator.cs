using FluentValidation;

namespace CCMS.Application.Features.Bookings.Commands;

public class CreateBookingCommandValidator : AbstractValidator<CreateBookingCommand>
{
    public CreateBookingCommandValidator()
    {
        RuleFor(x => x.Request.ScreenId)
            .NotEmpty()
            .WithMessage("Screen ID is required.");

        RuleFor(x => x.Request.CampaignId)
            .NotEmpty()
            .WithMessage("Campaign ID is required.");

        RuleFor(x => x.Request.CreativeId)
            .NotEmpty()
            .WithMessage("Creative ID is required.");

        RuleFor(x => x.Request.StartDate)
            .NotEmpty()
            .WithMessage("Start date is required.")
            .Must(startDate => startDate.Date >= DateTime.UtcNow.Date.AddDays(1))
            .WithMessage("Booking start date must be at least tomorrow. Same-day bookings are not allowed.");

        RuleFor(x => x.Request.EndDate)
            .NotEmpty()
            .WithMessage("End date is required.")
            .GreaterThanOrEqualTo(x => x.Request.StartDate)
            .WithMessage("End date must be greater than or equal to start date.");
    }
}
