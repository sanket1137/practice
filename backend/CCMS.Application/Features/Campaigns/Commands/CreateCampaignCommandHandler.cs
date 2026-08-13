using AutoMapper;
using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Campaigns;

namespace CCMS.Application.Features.Campaigns.Commands;

public class CreateCampaignCommandHandler : IRequestHandler<CreateCampaignCommand, CampaignDto>
{
    private readonly IRepository<Campaign> _campaignRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    public CreateCampaignCommandHandler(
        IRepository<Campaign> campaignRepository,
        IUnitOfWork unitOfWork,
        IMapper mapper)
    {
        _campaignRepository = campaignRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<CampaignDto> Handle(CreateCampaignCommand request, CancellationToken cancellationToken)
    {
        // Parse date strings to DateOnly (no timezone issues - dates are dates!)
        if (!DateOnly.TryParse(request.Request.StartDate, out var startDate))
            throw new InvalidOperationException($"Invalid start date format: {request.Request.StartDate}. Expected YYYY-MM-DD.");
        
        if (!DateOnly.TryParse(request.Request.EndDate, out var endDate))
            throw new InvalidOperationException($"Invalid end date format: {request.Request.EndDate}. Expected YYYY-MM-DD.");

        var campaign = new Campaign
        {
            AdvertiserId = request.UserId,
            Name = request.Request.Name,
            Description = request.Request.Description,
            Budget = request.Request.Budget,
            Currency = request.Request.Currency,
            StartDate = startDate,   // DateOnly - no timezone conversion needed!
            EndDate = endDate,       // DateOnly - no timezone conversion needed!
            Status = Domain.Enums.CampaignStatus.Draft,
            CreatedAt = DateTime.UtcNow
        };

        await _campaignRepository.AddAsync(campaign, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<CampaignDto>(campaign);
    }
}
