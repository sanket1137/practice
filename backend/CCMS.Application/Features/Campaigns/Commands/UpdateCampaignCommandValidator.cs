using FluentValidation;

namespace CCMS.Application.Features.Campaigns.Commands;

public class UpdateCampaignCommandValidator : AbstractValidator<UpdateCampaignCommand>
{
    public UpdateCampaignCommandValidator()
    {
        RuleFor(x => x.CampaignId)
            .NotEmpty()
            .WithMessage("Campaign ID is required.");

        RuleFor(x => x.UserId)
            .NotEmpty()
            .WithMessage("User ID is required.");

        RuleFor(x => x.Request.Name)
            .NotEmpty()
            .WithMessage("Campaign name cannot be empty.")
            .MaximumLength(200)
            .WithMessage("Campaign name must not exceed 200 characters.")
            .When(x => x.Request.Name != null);

        RuleFor(x => x.Request.Description)
            .MaximumLength(2000)
            .WithMessage("Description must not exceed 2000 characters.")
            .When(x => x.Request.Description != null);

        RuleFor(x => x.Request.Budget)
            .GreaterThan(0)
            .WithMessage("Budget must be greater than 0.")
            .When(x => x.Request.Budget.HasValue);

        RuleFor(x => x.Request.StartDate)
            .Must(BeValidDateFormat)
            .WithMessage("Start date must be in YYYY-MM-DD format.")
            .When(x => x.Request.StartDate != null);

        RuleFor(x => x.Request.EndDate)
            .Must(BeValidDateFormat)
            .WithMessage("End date must be in YYYY-MM-DD format.")
            .When(x => x.Request.EndDate != null);

        RuleFor(x => x.Request)
            .Must(r => BeGreaterThanOrEqualToStartDate(r.StartDate, r.EndDate))
            .WithMessage("End date must be greater than or equal to start date.")
            .When(x => x.Request.StartDate != null && x.Request.EndDate != null);

        RuleFor(x => x.Request.Status)
            .MaximumLength(50)
            .WithMessage("Status must not exceed 50 characters.")
            .When(x => x.Request.Status != null);
    }

    private static bool BeValidDateFormat(string? dateStr)
    {
        if (dateStr == null) return true;
        return DateOnly.TryParse(dateStr, out _);
    }

    private static bool BeGreaterThanOrEqualToStartDate(string? startDateStr, string? endDateStr)
    {
        if (startDateStr == null || endDateStr == null) return true;
        if (!DateOnly.TryParse(startDateStr, out var startDate) ||
            !DateOnly.TryParse(endDateStr, out var endDate))
            return true; // format handled by other rules

        return endDate >= startDate;
    }
}
