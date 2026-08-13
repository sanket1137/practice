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
            .Must(BeValidDateFormat)
            .WithMessage("Start date must be in YYYY-MM-DD format.")
            .Must(BeAtLeastTomorrow)
            .WithMessage("Booking start date must be at least tomorrow. Same-day bookings are not allowed.");

        RuleFor(x => x.Request.EndDate)
            .NotEmpty()
            .WithMessage("End date is required.")
            .Must(BeValidDateFormat)
            .WithMessage("End date must be in YYYY-MM-DD format.")
            .Must((command, endDate) => BeGreaterThanOrEqualToStartDate(command.Request.StartDate, endDate))
            .WithMessage("End date must be greater than or equal to start date.");
    }

    private static bool BeValidDateFormat(string dateStr)
    {
        return DateOnly.TryParse(dateStr, out _);
    }

    private static bool BeAtLeastTomorrow(string dateStr)
    {
        if (!DateOnly.TryParse(dateStr, out var date))
            return false;
        
        var tomorrow = DateOnly.FromDateTime(DateTime.Today.AddDays(1));
        return date >= tomorrow;
    }

    private static bool BeGreaterThanOrEqualToStartDate(string startDateStr, string endDateStr)
    {
        if (!DateOnly.TryParse(startDateStr, out var startDate) ||
            !DateOnly.TryParse(endDateStr, out var endDate))
            return false;
        
        return endDate >= startDate;
    }
}
