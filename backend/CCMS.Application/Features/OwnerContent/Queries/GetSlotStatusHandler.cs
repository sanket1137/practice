using CCMS.Application.Helpers;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.OwnerContent;
using MediatR;
using Microsoft.Extensions.Configuration;

namespace CCMS.Application.Features.OwnerContent.Queries;

public class GetSlotStatusHandler : IRequestHandler<GetSlotStatusQuery, List<SlotStatusDto>>
{
    private readonly IRepository<Screen> _screenRepo;
    private readonly IRepository<Booking> _bookingRepo;
    private readonly IRepository<Domain.Entities.OwnerContent> _ownerContentRepo;
    private readonly IRepository<Impression> _impressionRepo;
    private readonly IRepository<Creative> _creativeRepo;
    private readonly string _r2PublicUrlBase;

    public GetSlotStatusHandler(
        IRepository<Screen> screenRepo,
        IRepository<Booking> bookingRepo,
        IRepository<Domain.Entities.OwnerContent> ownerContentRepo,
        IRepository<Impression> impressionRepo,
        IRepository<Creative> creativeRepo,
        IConfiguration configuration)
    {
        _screenRepo = screenRepo;
        _bookingRepo = bookingRepo;
        _ownerContentRepo = ownerContentRepo;
        _impressionRepo = impressionRepo;
        _creativeRepo = creativeRepo;
        _r2PublicUrlBase = configuration["R2:PublicUrlBase"] ?? "";
    }

    public async Task<List<SlotStatusDto>> Handle(GetSlotStatusQuery request, CancellationToken cancellationToken)
    {
        var screen = await _screenRepo.GetByIdAsync(request.ScreenId, cancellationToken);
        if (screen == null)
            throw new KeyNotFoundException($"Screen {request.ScreenId} not found");

        var now = DateTime.UtcNow;
        var nowDate = DateOnly.FromDateTime(now);
        
        // Get active bookings with Creative loaded
        var activeBookings = (await _bookingRepo.FindAsync(b =>
            b.ScreenId == request.ScreenId &&
            (b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active) &&
            b.StartDate <= nowDate &&
            b.EndDate >= nowDate,
            cancellationToken)).ToList();
        
        // Load creatives for all bookings
        foreach (var booking in activeBookings)
        {
            if (booking.CreativeId != Guid.Empty)
            {
                booking.Creative = await _creativeRepo.GetByIdAsync(booking.CreativeId, cancellationToken);
            }
        }

        // Get owner content
        var ownerContents = (await _ownerContentRepo.FindAsync(oc =>
            oc.ScreenId == request.ScreenId && oc.IsActive,
            cancellationToken)).ToList();

        // Get impressions for owner content
        var allImpressions = (await _impressionRepo.FindAsync(i =>
            i.OwnerContentId != null && i.ScreenId == request.ScreenId,
            cancellationToken)).ToList();
            
        var impressionCounts = allImpressions
            .Where(i => i.OwnerContentId.HasValue)
            .GroupBy(i => i.OwnerContentId.Value)
            .ToDictionary(g => g.Key, g => g.Count());

        var slots = new List<SlotStatusDto>();
        
        // Parse daily slot assignments for each booking
        var todayDate = DateTime.UtcNow.Date;
        var bookingSlotMap = new Dictionary<int, Booking>(); // slot -> booking
        
        foreach (var booking in activeBookings)
        {
            if (!string.IsNullOrEmpty(booking.DailySlotAssignmentsJson))
            {
                try
                {
                    var assignments = System.Text.Json.JsonSerializer.Deserialize<Dictionary<DateTime, int>>(booking.DailySlotAssignmentsJson);
                    if (assignments != null)
                    {
                        // Find today's assignment
                        var todayAssignment = assignments.FirstOrDefault(kvp => kvp.Key.Date == todayDate);
                        if (todayAssignment.Key != default && todayAssignment.Value > 0)
                        {
                            bookingSlotMap[todayAssignment.Value] = booking;
                        }
                    }
                }
                catch (Exception)
                {
                    // Fallback to original SlotNumbers if JSON parsing fails
                    foreach (var slotNum in booking.SlotNumbers)
                    {
                        bookingSlotMap[slotNum] = booking;
                    }
                }
            }
            else
            {
                // No daily assignments, use original SlotNumbers
                foreach (var slotNum in booking.SlotNumbers)
                {
                    bookingSlotMap[slotNum] = booking;
                }
            }
        }

        for (int slot = 1; slot <= screen.SlotsPerFrame; slot++)
        {
            var booking = bookingSlotMap.GetValueOrDefault(slot);
            var ownerContent = ownerContents.FirstOrDefault(oc => oc.SlotNumber == slot);

            if (booking != null)
            {
                // Active booking - slot is locked
                slots.Add(new SlotStatusDto
                {
                    SlotNumber = slot,
                    Status = "Booked",
                    ContentName = booking.Creative?.Name ?? "Booked Content",
                    VideoUrl = MediaUrlHelper.ToProxyUrl(booking.Creative?.FileUrl, _r2PublicUrlBase),
                    CanEdit = false
                });
            }
            else if (ownerContent != null)
            {
                // Owner custom content
                var plays = impressionCounts.GetValueOrDefault(ownerContent.Id, 0);
                slots.Add(new SlotStatusDto
                {
                    SlotNumber = slot,
                    Status = "Custom",
                    ContentName = ownerContent.Name,
                    VideoUrl = MediaUrlHelper.ToProxyUrl(ownerContent.FileUrl, _r2PublicUrlBase),
                    CanEdit = true,
                    OwnerContent = new OwnerContentDto
                    {
                        Id = ownerContent.Id,
                        SlotNumber = ownerContent.SlotNumber,
                        Name = ownerContent.Name,
                        FileUrl = MediaUrlHelper.ToProxyUrl(ownerContent.FileUrl, _r2PublicUrlBase),
                        Duration = ownerContent.Duration,
                        PricePerPlay = ownerContent.PricePerPlay,
                        TotalPlays = plays,
                        TotalRevenue = plays * ownerContent.PricePerPlay,
                        CreatedAt = ownerContent.CreatedAt,
                        UpdatedAt = ownerContent.UpdatedAt
                    }
                });
            }
            else
            {
                // Empty slot - default video
                slots.Add(new SlotStatusDto
                {
                    SlotNumber = slot,
                    Status = "Empty",
                    ContentName = "Default Video",
                    VideoUrl = MediaUrlHelper.ToProxyUrl(screen.DefaultVideoUrl, _r2PublicUrlBase),
                    CanEdit = true
                });
            }
        }

        return slots;
    }
}
