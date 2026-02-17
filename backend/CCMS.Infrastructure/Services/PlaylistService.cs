using Microsoft.EntityFrameworkCore;
using CCMS.Application.Interfaces;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using CCMS.Shared.DTOs.Player;

namespace CCMS.Infrastructure.Services;

public class PlaylistService : IPlaylistService
{
    private readonly ApplicationDbContext _context;

    public PlaylistService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<PlaylistDto> GeneratePlaylistForScreenAsync(Guid screenId, DateTime date, CancellationToken cancellationToken = default)
    {
        var screen = await _context.Screens
            .FirstOrDefaultAsync(s => s.Id == screenId, cancellationToken);

        if (screen == null)
        {
            throw new ArgumentException($"Screen with ID {screenId} not found");
        }

        // Get approved bookings for this screen and date
        var bookingDate = DateOnly.FromDateTime(date);
        var bookings = await _context.Bookings
            .Include(b => b.Creative)
            .Where(b => b.ScreenId == screenId 
                && b.Status == BookingStatus.Approved
                && b.StartDate <= bookingDate 
                && b.EndDate >= bookingDate)
            .ToListAsync(cancellationToken);

        // Get active owner content
        var ownerContents = await _context.OwnerContents
            .Where(oc => oc.ScreenId == screenId && oc.IsActive)
            .ToListAsync(cancellationToken);

        // Generate playlist with priority: Booking > Owner Content > Default
        var playlistItems = new List<PlaylistItemDto>();

        for (int slot = 1; slot <= screen.SlotsPerFrame; slot++)
        {
            // Priority 1: Check for advertiser booking
            var booking = bookings.FirstOrDefault(b => b.SlotNumbers.Contains(slot));
            
            if (booking != null)
            {
                playlistItems.Add(new PlaylistItemDto
                {
                    CreativeId = booking.CreativeId,
                    BookingId = booking.Id,
                    FileUrl = booking.Creative.FileUrl,
                    FileHash = booking.Creative.FileHash,
                    Duration = booking.Creative.Duration,
                    SlotPosition = slot,
                    RepeatCount = 1
                });
            }
            else
            {
                // Priority 2: Check for owner custom content
                var ownerContent = ownerContents.FirstOrDefault(oc => oc.SlotNumber == slot);
                
                if (ownerContent != null)
                {
                    playlistItems.Add(new PlaylistItemDto
                    {
                        CreativeId = Guid.Empty, // No creative ID for owner content
                        BookingId = null,
                        OwnerContentId = ownerContent.Id,
                        FileUrl = ownerContent.FileUrl,
                        FileHash = ownerContent.FileHash,
                        Duration = ownerContent.Duration,
                        SlotPosition = slot,
                        RepeatCount = 1
                    });
                }
                // Priority 3: Default video (player will handle if nothing else)
            }
        }

        return new PlaylistDto
        {
            ScreenId = screenId,
            Date = date,
            Items = playlistItems
        };
    }


    public async Task<PlaylistDto> GetTodayPlaylistAsync(string deviceId, CancellationToken cancellationToken = default)
    {
        var screen = await _context.Screens
            .FirstOrDefaultAsync(s => s.DeviceId == deviceId, cancellationToken);

        if (screen == null)
        {
            throw new ArgumentException($"Screen with device ID {deviceId} not found");
        }

        return await GeneratePlaylistForScreenAsync(screen.Id, DateTime.UtcNow.Date, cancellationToken);
    }
}
