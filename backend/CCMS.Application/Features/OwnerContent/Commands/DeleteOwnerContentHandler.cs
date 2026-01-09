using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;

namespace CCMS.Application.Features.OwnerContent.Commands;

public class DeleteOwnerContentHandler : IRequestHandler<DeleteOwnerContentCommand, bool>
{
    private readonly IRepository<Domain.Entities.OwnerContent> _ownerContentRepo;
    private readonly IRepository<Screen> _screenRepo;
    private readonly ILogger<DeleteOwnerContentHandler> _logger;
    private readonly IPlaylistNotificationService _notificationService;

    public DeleteOwnerContentHandler(
        IRepository<Domain.Entities.OwnerContent> ownerContentRepo,
        IRepository<Screen> screenRepo,
        ILogger<DeleteOwnerContentHandler> logger,
        IPlaylistNotificationService notificationService)
    {
        _ownerContentRepo = ownerContentRepo;
        _screenRepo = screenRepo;
        _logger = logger;
        _notificationService = notificationService;
    }

    public async Task<bool> Handle(DeleteOwnerContentCommand request, CancellationToken cancellationToken)
    {
        // 1. Validate screen ownership
        var screen = await _screenRepo.GetByIdAsync(request.ScreenId, cancellationToken);
        if (screen == null)
            throw new KeyNotFoundException($"Screen {request.ScreenId} not found");
            
        if (screen.OwnerId != request.OwnerId)
            throw new UnauthorizedAccessException("You do not own this screen");

        // 2. Find owner content
        var content = (await _ownerContentRepo.FindAsync(oc =>
            oc.ScreenId == request.ScreenId &&
            oc.SlotNumber == request.SlotNumber &&
            oc.IsActive,
            cancellationToken)).FirstOrDefault();

        if (content == null)
        {
            _logger.LogWarning($"No active content found for screen {request.ScreenId} slot {request.SlotNumber}");
            return false;
        }

        // 3. Soft delete
        content.IsActive = false;
        content.UpdatedAt = DateTime.UtcNow;
        await _ownerContentRepo.UpdateAsync(content, cancellationToken);
        
        _logger.LogInformation($"Owner content deleted: Slot {request.SlotNumber} on screen {request.ScreenId}");

        // 4. Notify player
        try
        {
            await _notificationService.NotifyPlaylistUpdatedAsync(
                request.ScreenId,
                request.SlotNumber,
                "ContentRemoved",
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning($"Failed to send notification: {ex.Message}");
        }

        return true;
    }
}
