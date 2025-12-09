using MediatR;
using CCMS.Shared.DTOs.Campaigns;

namespace CCMS.Application.Features.Campaigns.Queries;

public class GetCampaignsQuery : IRequest<IEnumerable<CampaignDto>>
{
    public Guid UserId { get; set; }
}
