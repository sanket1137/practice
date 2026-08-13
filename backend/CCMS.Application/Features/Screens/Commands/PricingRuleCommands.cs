using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Features.Screens.Commands;

public class CreatePricingRuleCommand : IRequest<PricingRuleDto>
{
    public Guid ScreenId { get; set; }
    public Guid UserId { get; set; }
    public CreatePricingRuleRequest Request { get; set; } = null!;
}

public class UpdatePricingRuleCommand : IRequest<PricingRuleDto>
{
    public Guid RuleId { get; set; }
    public Guid UserId { get; set; }
    public UpdatePricingRuleRequest Request { get; set; } = null!;
}

public class DeletePricingRuleCommand : IRequest<bool>
{
    public Guid RuleId { get; set; }
    public Guid UserId { get; set; }
}

public class TogglePricingRuleCommand : IRequest<PricingRuleDto>
{
    public Guid RuleId { get; set; }
    public Guid UserId { get; set; }
}

// -- Handlers --------------------------------------------------------------

public class CreatePricingRuleCommandHandler : IRequestHandler<CreatePricingRuleCommand, PricingRuleDto>
{
    private readonly IRepository<PricingRule> _ruleRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IUnitOfWork _unitOfWork;

    public CreatePricingRuleCommandHandler(
        IRepository<PricingRule> ruleRepository,
        IRepository<Screen> screenRepository,
        IUnitOfWork unitOfWork)
    {
        _ruleRepository = ruleRepository;
        _screenRepository = screenRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<PricingRuleDto> Handle(CreatePricingRuleCommand request, CancellationToken cancellationToken)
    {
        var screens = await _screenRepository.FindAsync(s => s.Id == request.ScreenId && s.OwnerId == request.UserId && !s.IsDeleted, cancellationToken);
        if (!screens.Any())
            throw new UnauthorizedAccessException("Screen not found or you do not own it");

        if (!Enum.TryParse<PricingRuleType>(request.Request.RuleType, out var ruleType))
            throw new InvalidOperationException($"Invalid rule type: {request.Request.RuleType}");

        var rule = new PricingRule
        {
            ScreenId = request.ScreenId,
            Name = request.Request.Name,
            RuleType = ruleType,
            RegularSlotPrice = request.Request.RegularSlotPrice,
            IsActive = request.Request.IsActive,
            DaysOfWeek = request.Request.DaysOfWeek,
            StartDate = request.Request.StartDate != null ? DateOnly.Parse(request.Request.StartDate) : null,
            EndDate = request.Request.EndDate != null ? DateOnly.Parse(request.Request.EndDate) : null,
            CreatedAt = DateTime.UtcNow
        };

        await _ruleRepository.AddAsync(rule, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return MapToDto(rule);
    }

    internal static PricingRuleDto MapToDto(PricingRule r) => new()
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
    };
}

public class UpdatePricingRuleCommandHandler : IRequestHandler<UpdatePricingRuleCommand, PricingRuleDto>
{
    private readonly IRepository<PricingRule> _ruleRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IUnitOfWork _unitOfWork;

    public UpdatePricingRuleCommandHandler(
        IRepository<PricingRule> ruleRepository,
        IRepository<Screen> screenRepository,
        IUnitOfWork unitOfWork)
    {
        _ruleRepository = ruleRepository;
        _screenRepository = screenRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<PricingRuleDto> Handle(UpdatePricingRuleCommand request, CancellationToken cancellationToken)
    {
        var rule = await _ruleRepository.GetByIdAsync(request.RuleId, cancellationToken)
            ?? throw new KeyNotFoundException("Pricing rule not found");

        var screens = await _screenRepository.FindAsync(s => s.Id == rule.ScreenId && s.OwnerId == request.UserId, cancellationToken);
        if (!screens.Any())
            throw new UnauthorizedAccessException("You do not own this screen");

        if (!Enum.TryParse<PricingRuleType>(request.Request.RuleType, out var ruleType))
            throw new InvalidOperationException($"Invalid rule type: {request.Request.RuleType}");

        rule.Name = request.Request.Name;
        rule.RuleType = ruleType;
        rule.RegularSlotPrice = request.Request.RegularSlotPrice;
        rule.IsActive = request.Request.IsActive;
        rule.DaysOfWeek = request.Request.DaysOfWeek;
        rule.StartDate = request.Request.StartDate != null ? DateOnly.Parse(request.Request.StartDate) : null;
        rule.EndDate = request.Request.EndDate != null ? DateOnly.Parse(request.Request.EndDate) : null;

        await _ruleRepository.UpdateAsync(rule, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return CreatePricingRuleCommandHandler.MapToDto(rule);
    }
}

public class DeletePricingRuleCommandHandler : IRequestHandler<DeletePricingRuleCommand, bool>
{
    private readonly IRepository<PricingRule> _ruleRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IUnitOfWork _unitOfWork;

    public DeletePricingRuleCommandHandler(
        IRepository<PricingRule> ruleRepository,
        IRepository<Screen> screenRepository,
        IUnitOfWork unitOfWork)
    {
        _ruleRepository = ruleRepository;
        _screenRepository = screenRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<bool> Handle(DeletePricingRuleCommand request, CancellationToken cancellationToken)
    {
        var rule = await _ruleRepository.GetByIdAsync(request.RuleId, cancellationToken)
            ?? throw new KeyNotFoundException("Pricing rule not found");

        var screens = await _screenRepository.FindAsync(s => s.Id == rule.ScreenId && s.OwnerId == request.UserId, cancellationToken);
        if (!screens.Any())
            throw new UnauthorizedAccessException("You do not own this screen");

        await _ruleRepository.DeleteAsync(request.RuleId, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public class TogglePricingRuleCommandHandler : IRequestHandler<TogglePricingRuleCommand, PricingRuleDto>
{
    private readonly IRepository<PricingRule> _ruleRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IUnitOfWork _unitOfWork;

    public TogglePricingRuleCommandHandler(
        IRepository<PricingRule> ruleRepository,
        IRepository<Screen> screenRepository,
        IUnitOfWork unitOfWork)
    {
        _ruleRepository = ruleRepository;
        _screenRepository = screenRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<PricingRuleDto> Handle(TogglePricingRuleCommand request, CancellationToken cancellationToken)
    {
        var rule = await _ruleRepository.GetByIdAsync(request.RuleId, cancellationToken)
            ?? throw new KeyNotFoundException("Pricing rule not found");

        var screens = await _screenRepository.FindAsync(s => s.Id == rule.ScreenId && s.OwnerId == request.UserId, cancellationToken);
        if (!screens.Any())
            throw new UnauthorizedAccessException("You do not own this screen");

        rule.IsActive = !rule.IsActive;
        await _ruleRepository.UpdateAsync(rule, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return CreatePricingRuleCommandHandler.MapToDto(rule);
    }
}
