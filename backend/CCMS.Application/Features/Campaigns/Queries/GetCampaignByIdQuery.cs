using MediatR;
using CCMS.Shared.DTOs.Campaigns;

namespace CCMS.Application.Features.Campaigns.Queries;

public class GetCampaignByIdQuery : IRequest<CampaignDto?>
{
    public Guid CampaignId { get; set; }
}
