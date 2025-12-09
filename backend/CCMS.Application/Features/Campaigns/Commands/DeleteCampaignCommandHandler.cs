using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using MediatR;

namespace CCMS.Application.Features.Campaigns.Commands;

public class DeleteCampaignCommandHandler : IRequestHandler<DeleteCampaignCommand, Unit>
{
    private readonly IRepository<Campaign> _campaignRepository;
    private readonly IRepository<Creative> _creativeRepository;
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IUnitOfWork _unitOfWork;

    public DeleteCampaignCommandHandler(
        IRepository<Campaign> campaignRepository,
        IRepository<Creative> creativeRepository,
        IRepository<Booking> bookingRepository,
        IUnitOfWork unitOfWork)
    {
        _campaignRepository = campaignRepository;
        _creativeRepository = creativeRepository;
        _bookingRepository = bookingRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<Unit> Handle(DeleteCampaignCommand request, CancellationToken cancellationToken)
    {
        var campaign = await _campaignRepository.GetByIdAsync(request.CampaignId, cancellationToken);

        if (campaign == null)
            throw new KeyNotFoundException($"Campaign with ID {request.CampaignId} not found");

        // Check if user owns this campaign (or is admin)
        if (campaign.AdvertiserId != request.UserId && !request.IsAdmin)
            throw new UnauthorizedAccessException("You don't have permission to delete this campaign");

        // Soft delete approach - just mark as deleted
        campaign.IsDeleted = true;
        campaign.UpdatedAt = DateTime.UtcNow;

        await _campaignRepository.UpdateAsync(campaign, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}
