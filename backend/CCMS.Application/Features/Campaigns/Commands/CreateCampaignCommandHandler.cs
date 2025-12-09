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
        var campaign = new Campaign
        {
            AdvertiserId = request.UserId,
            Name = request.Request.Name,
            Description = request.Request.Description,
            Budget = request.Request.Budget,
            Currency = request.Request.Currency,
            StartDate = request.Request.StartDate,
            EndDate = request.Request.EndDate,
            Status = Domain.Enums.CampaignStatus.Draft,
            CreatedAt = DateTime.UtcNow
        };

        await _campaignRepository.AddAsync(campaign, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<CampaignDto>(campaign);
    }
}
