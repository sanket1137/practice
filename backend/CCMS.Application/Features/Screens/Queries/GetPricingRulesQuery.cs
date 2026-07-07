using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Features.Screens.Queries;

public class GetPricingRulesQuery : IRequest<IEnumerable<PricingRuleDto>>
{
    public Guid ScreenId { get; set; }
    public bool ActiveOnly { get; set; } = false;
}

public class GetPricingRulesQueryHandler : IRequestHandler<GetPricingRulesQuery, IEnumerable<PricingRuleDto>>
{
    private readonly IRepository<PricingRule> _ruleRepository;

    public GetPricingRulesQueryHandler(IRepository<PricingRule> ruleRepository)
    {
        _ruleRepository = ruleRepository;
    }

    public async Task<IEnumerable<PricingRuleDto>> Handle(GetPricingRulesQuery request, CancellationToken cancellationToken)
    {
        var rules = await _ruleRepository.FindAsync(r => r.ScreenId == request.ScreenId && !r.IsDeleted, cancellationToken);

        if (request.ActiveOnly)
            rules = rules.Where(r => r.IsActive);

        return rules
            .OrderByDescending(r => r.IsActive)
            .ThenBy(r => r.CreatedAt)
            .Select(r => new PricingRuleDto
            {
                Id = r.Id,
                ScreenId = r.ScreenId,
                Name = r.Name,
                RuleType = r.RuleType.ToString(),
                RegularSlotPrice = r.RegularSlotPrice,
                IsActive = r.IsActive,
                StartDate = r.StartDate?.ToString("yyyy-MM-dd"),
                EndDate = r.EndDate?.ToString("yyyy-MM-dd"),
                DaysOfWeek = r.DaysOfWeek,
                CreatedAt = r.CreatedAt
            });
    }
}
