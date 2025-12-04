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
        var bookings = await _context.Bookings
            .Include(b => b.Creative)
            .Where(b => b.ScreenId == screenId 
                && b.Status == BookingStatus.Approved
                && b.StartDate <= date 
                && b.EndDate >= date)
            .ToListAsync(cancellationToken);

        // Generate playlist items
        var playlistItems = new List<PlaylistItemDto>();

        foreach (var booking in bookings)
        {
            foreach (var slotNumber in booking.SlotNumbers)
            {
                playlistItems.Add(new PlaylistItemDto
                {
                    CreativeId = booking.CreativeId,
                    BookingId = booking.Id,
                    FileUrl = booking.Creative.FileUrl,
                    FileHash = booking.Creative.FileHash,
                    Duration = booking.Creative.Duration,
                    SlotPosition = slotNumber,
                    RepeatCount = 1
                });
            }
        }

        // Sort by slot position
        playlistItems = playlistItems.OrderBy(p => p.SlotPosition).ToList();

        return new PlaylistDto
        {
            ScreenId = screenId,
            Date = date.Date,
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

        // Update last sync time
        screen.LastSyncAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return await GeneratePlaylistForScreenAsync(screen.Id, DateTime.UtcNow.Date, cancellationToken);
    }
}
