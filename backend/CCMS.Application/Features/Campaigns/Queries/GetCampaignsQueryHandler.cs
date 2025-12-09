using AutoMapper;
using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Campaigns;

namespace CCMS.Application.Features.Campaigns.Queries;

public class GetCampaignsQueryHandler : IRequestHandler<GetCampaignsQuery, IEnumerable<CampaignDto>>
{
    private readonly IRepository<Campaign> _campaignRepository;
    private readonly IMapper _mapper;

    public GetCampaignsQueryHandler(IRepository<Campaign> campaignRepository, IMapper mapper)
    {
        _campaignRepository = campaignRepository;
        _mapper = mapper;
    }

    public async Task<IEnumerable<CampaignDto>> Handle(GetCampaignsQuery request, CancellationToken cancellationToken)
    {
        // Only return campaigns belonging to the logged-in user (or all for Admin)
        var campaigns = request.UserId == Guid.Empty
            ? await _campaignRepository.GetAllAsync()
            : await _campaignRepository.FindAsync(c => c.AdvertiserId == request.UserId);

        return _mapper.Map<IEnumerable<CampaignDto>>(campaigns);
    }
}
