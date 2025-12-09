using MediatR;
using CCMS.Shared.DTOs.Campaigns;

namespace CCMS.Application.Features.Campaigns.Commands;

public class CreateCampaignCommand : IRequest<CampaignDto>
{
    public Guid UserId { get; set; }
    public CreateCampaignRequest Request { get; set; } = null!;
}
