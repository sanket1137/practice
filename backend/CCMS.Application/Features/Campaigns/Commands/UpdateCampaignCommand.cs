using MediatR;
using CCMS.Shared.DTOs.Campaigns;

namespace CCMS.Application.Features.Campaigns.Commands;

public class UpdateCampaignCommand : IRequest<CampaignDto>
{
    public Guid CampaignId { get; set; }
    public Guid UserId { get; set; }
    public bool IsAdmin { get; set; }
    public UpdateCampaignRequest Request { get; set; } = null!;
}
