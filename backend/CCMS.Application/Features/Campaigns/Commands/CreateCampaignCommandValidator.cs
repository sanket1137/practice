using FluentValidation;

namespace CCMS.Application.Features.Campaigns.Commands;

public class CreateCampaignCommandValidator : AbstractValidator<CreateCampaignCommand>
{
    public CreateCampaignCommandValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty()
            .WithMessage("User ID is required.");

        RuleFor(x => x.Request.Name)
            .NotEmpty()
            .WithMessage("Campaign name is required.")
            .MaximumLength(200)
            .WithMessage("Campaign name must not exceed 200 characters.");

        RuleFor(x => x.Request.Description)
            .MaximumLength(2000)
            .WithMessage("Description must not exceed 2000 characters.");

        RuleFor(x => x.Request.Budget)
            .GreaterThan(0)
            .WithMessage("Budget must be greater than 0.");

        RuleFor(x => x.Request.Currency)
            .NotEmpty()
            .WithMessage("Currency is required.")
            .MaximumLength(10)
            .WithMessage("Currency code must not exceed 10 characters.");

        RuleFor(x => x.Request.StartDate)
            .NotEmpty()
            .WithMessage("Start date is required.")
            .Must(BeValidDateFormat)
            .WithMessage("Start date must be in YYYY-MM-DD format.");

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

    private static bool BeGreaterThanOrEqualToStartDate(string startDateStr, string endDateStr)
    {
        if (!DateOnly.TryParse(startDateStr, out var startDate) ||
            !DateOnly.TryParse(endDateStr, out var endDate))
            return false;

        return endDate >= startDate;
    }
}
