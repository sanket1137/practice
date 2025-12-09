using AutoMapper;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Campaigns;
using MediatR;

namespace CCMS.Application.Features.Campaigns.Commands;

public class UpdateCampaignCommandHandler : IRequestHandler<UpdateCampaignCommand, CampaignDto>
{
    private readonly IRepository<Campaign> _campaignRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    public UpdateCampaignCommandHandler(
        IRepository<Campaign> campaignRepository, 
        IUnitOfWork unitOfWork,
        IMapper mapper)
    {
        _campaignRepository = campaignRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<CampaignDto> Handle(UpdateCampaignCommand request, CancellationToken cancellationToken)
    {
        var campaign = await _campaignRepository.GetByIdAsync(request.CampaignId, cancellationToken);

        if (campaign == null)
            throw new KeyNotFoundException($"Campaign with ID {request.CampaignId} not found");

        // Check if user owns this campaign (or is admin)
        if (campaign.AdvertiserId != request.UserId && !request.IsAdmin)
            throw new UnauthorizedAccessException("You don't have permission to update this campaign");

        if (!string.IsNullOrWhiteSpace(request.Request.Name))
            campaign.Name = request.Request.Name;
        
        if (!string.IsNullOrWhiteSpace(request.Request.Description))
            campaign.Description = request.Request.Description;
        
        if (request.Request.Budget.HasValue)
            campaign.Budget = request.Request.Budget.Value;
        
        if (request.Request.StartDate.HasValue)
            campaign.StartDate = request.Request.StartDate.Value;
        
        if (request.Request.EndDate.HasValue)
            campaign.EndDate = request.Request.EndDate.Value;
        
        if (!string.IsNullOrWhiteSpace(request.Request.Status))
        {
            if (Enum.TryParse<Domain.Enums.CampaignStatus>(request.Request.Status, out var status))
                campaign.Status = status;
        }

        campaign.UpdatedAt = DateTime.UtcNow;

        await _campaignRepository.UpdateAsync(campaign, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<CampaignDto>(campaign);
    }
}
