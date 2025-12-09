using MediatR;

namespace CCMS.Application.Features.Campaigns.Commands;

public class DeleteCampaignCommand : IRequest<Unit>
{
    public Guid CampaignId { get; set; }
    public Guid UserId { get; set; }
    public bool IsAdmin { get; set; }
}
