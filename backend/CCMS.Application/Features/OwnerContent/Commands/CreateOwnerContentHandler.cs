using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.OwnerContent;
using MediatR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using CCMS.Application.Helpers;

namespace CCMS.Application.Features.OwnerContent.Commands;

public class CreateOwnerContentHandler : IRequestHandler<CreateOwnerContentCommand, OwnerContentDto>
{
    private readonly IRepository<Domain.Entities.OwnerContent> _ownerContentRepo;
    private readonly IRepository<Screen> _screenRepo;
    private readonly IRepository<Booking> _bookingRepo;
    private readonly IFileStorageService _fileStorage;
    private readonly ILogger<CreateOwnerContentHandler> _logger;
    private readonly IPlaylistNotificationService _notificationService;
    private readonly string _r2PublicUrlBase;

    public CreateOwnerContentHandler(
        IRepository<Domain.Entities.OwnerContent> ownerContentRepo,
        IRepository<Screen> screenRepo,
        IRepository<Booking> bookingRepo,
        IFileStorageService fileStorage,
        ILogger<CreateOwnerContentHandler> logger,
        IPlaylistNotificationService notificationService,
        IConfiguration configuration)
    {
        _ownerContentRepo = ownerContentRepo;
        _screenRepo = screenRepo;
        _bookingRepo = bookingRepo;
        _fileStorage = fileStorage;
        _logger = logger;
        _notificationService = notificationService;
        _r2PublicUrlBase = configuration["R2:PublicUrlBase"] ?? "";
    }

    public async Task<OwnerContentDto> Handle(CreateOwnerContentCommand request, CancellationToken cancellationToken)
    {
        // 1. Validate screen ownership
        var screen = await _screenRepo.GetByIdAsync(request.ScreenId, cancellationToken);
        if (screen == null)
            throw new KeyNotFoundException($"Screen {request.ScreenId} not found");
            
        if (screen.OwnerId != request.OwnerId)
            throw new UnauthorizedAccessException("You do not own this screen");

        // 2. Check slot is not taken by active booking
        // Use GetAllAsync and filter in memory since SlotNumbers is a JSON column
        var allBookings = (await _bookingRepo.GetAllAsync(cancellationToken)).ToList();
        var todayDate = DateOnly.FromDateTime(DateTime.UtcNow);
        
        // Single comprehensive check: slot must not have any currently-active booking
        // Filter by date range so past bookings (even if still in Approved status) don't block the slot
        var activeBooking = allBookings.FirstOrDefault(b =>
            b.ScreenId == request.ScreenId &&
            b.SlotNumbers.Contains(request.SlotNumber) &&
            (b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active) &&
            b.StartDate <= todayDate &&
            b.EndDate >= todayDate &&
            !b.IsDeleted);

        if (activeBooking != null)
        {
            throw new InvalidOperationException(
                $"Slot {request.SlotNumber} has an active booking (ends {activeBooking.EndDate}). " +
                $"Owner content cannot be assigned to booked slots. " +
                $"Please choose a different slot or wait for the booking to complete.");
        }

        // 3. Upload file to Screens/{screenId}/owner/ folder
        var fileExtension = Path.GetExtension(request.FileName);
        var ownerContentPath = $"Screens/{request.ScreenId}/owner/slot{request.SlotNumber}_{Guid.NewGuid()}{fileExtension}";
        
        var fileUrl = await _fileStorage.UploadFileAsync(
            request.FileStream,
            ownerContentPath,
            request.ContentType,  // Use actual MIME type (e.g., video/mp4)
            cancellationToken);

        // 4. Create or update owner content
        // Try to create new content first
        var content = new Domain.Entities.OwnerContent
        {
            Id = Guid.NewGuid(),
            ScreenId = request.ScreenId,
            SlotNumber = request.SlotNumber,
            Name = request.Name,
            FileUrl = fileUrl,
            MimeType = request.ContentType,
            Duration = 10, // Will be updated by video processing
            PricePerPlay = request.PricePerPlay,
            Currency = request.Currency ?? "INR", // Default to INR if not provided
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        // Check for existing content (including soft-deleted)
        var existing = await _ownerContentRepo.FindOneIncludingDeletedAsync(
            oc => oc.ScreenId == request.ScreenId && oc.SlotNumber == request.SlotNumber,
            cancellationToken);

        if (existing != null)
        {
            _logger.LogInformation($"Found existing content for slot {request.SlotNumber}, hard deleting...");
            
            // HARD DELETE: Physically remove the old record to avoid unique index conflicts
            // This is a temporary fix until we implement multi-slot architecture
            await _ownerContentRepo.HardDeleteAsync(existing.Id, cancellationToken);
            await _ownerContentRepo.SaveChangesAsync(cancellationToken);
        }

        // Now add the new content
        await _ownerContentRepo.AddAsync(content, cancellationToken);
        _logger.LogInformation($"Owner content created: Slot {request.SlotNumber} on screen {request.ScreenId}");

        // 5. Notify player via SignalR
        try
        {
            await _notificationService.NotifyPlaylistUpdatedAsync(
                request.ScreenId, 
                request.SlotNumber, 
                "ContentUploaded", 
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning($"Failed to send notification: {ex.Message}");
        }

        return new OwnerContentDto
        {
            Id = content.Id,
            SlotNumber = content.SlotNumber,
            Name = content.Name,
            FileUrl = MediaUrlHelper.ToProxyUrl(content.FileUrl, _r2PublicUrlBase) ?? content.FileUrl,
            Duration = content.Duration,
            PricePerPlay = content.PricePerPlay,
            TotalPlays = 0,
            TotalRevenue = 0,
            CreatedAt = content.CreatedAt,
            UpdatedAt = content.UpdatedAt
        };
    }
}
