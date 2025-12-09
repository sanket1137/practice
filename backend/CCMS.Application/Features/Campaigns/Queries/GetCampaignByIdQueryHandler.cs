using AutoMapper;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Campaigns;
using MediatR;

namespace CCMS.Application.Features.Campaigns.Queries;

public class GetCampaignByIdQueryHandler : IRequestHandler<GetCampaignByIdQuery, CampaignDto?>
{
    private readonly IRepository<Campaign> _campaignRepository;
    private readonly IMapper _mapper;

    public GetCampaignByIdQueryHandler(IRepository<Campaign> campaignRepository, IMapper mapper)
    {
        _campaignRepository = campaignRepository;
        _mapper = mapper;
    }

    public async Task<CampaignDto?> Handle(GetCampaignByIdQuery request, CancellationToken cancellationToken)
    {
        var campaign = await _campaignRepository.GetByIdAsync(request.CampaignId, cancellationToken);
        return campaign == null ? null : _mapper.Map<CampaignDto>(campaign);
    }
}
