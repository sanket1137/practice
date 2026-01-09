using CCMS.Application.DTOs;
using CCMS.Application.Helpers;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace CCMS.Application.Services;

public class PlaylistGeneratorService
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Creative> _creativeRepository;
    private readonly IRepository<OwnerContent> _ownerContentRepository;
    private readonly ILogger<PlaylistGeneratorService> _logger;

    public PlaylistGeneratorService(
        IRepository<Screen> screenRepository,
        IRepository<Booking> bookingRepository,
        IRepository<Creative> creativeRepository,
        IRepository<OwnerContent> ownerContentRepository,
        ILogger<PlaylistGeneratorService> logger)
    {
        _screenRepository = screenRepository;
        _bookingRepository = bookingRepository;
        _creativeRepository = creativeRepository;
        _ownerContentRepository = ownerContentRepository;
        _logger = logger;
    }

    public async Task<PlaylistResponse?> GeneratePlaylistAsync(Guid screenId, DateTime date, CancellationToken cancellationToken = default)
    {
        // Fetch screen with configuration
        var screen = await _screenRepository.GetByIdAsync(screenId, cancellationToken);
        if (screen == null || screen.IsDeleted)
            return null;

        // Get operating hours for the specific day
        var daySchedule = screen.Schedule.GetScheduleForDay(date.DayOfWeek);
        
        if (!daySchedule.IsOperating)
        {
            // Screen not operating on this day
            return new PlaylistResponse
            {
                ScreenId = screenId,
                ScreenName = screen.Name,
                Date = date,
                OperatingStart = "00:00",
                OperatingEnd = "00:00",
                TimeFrameMinutes = screen.TimeFrameMinutes,
                SlotsPerFrame = screen.SlotsPerFrame,
                Playlist = new List<PlaylistItemResponse>()
            };
        }

        // Fetch owner content for this screen
        var allOwnerContent = await _ownerContentRepository.GetAllAsync(cancellationToken);
        var ownerContentItems = allOwnerContent
            .Where(oc => oc.ScreenId == screenId && !oc.IsDeleted && oc.IsActive)
            .ToList();

        // Fetch all approved/active bookings for this screen that overlap with the target date
        var bookings = await _bookingRepository.GetAllAsync(cancellationToken);
        
        var relevantBookings = bookings
            .Where(b => b.ScreenId == screenId 
                && !b.IsDeleted
                && (b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active || b.Status == BookingStatus.Completed)
                && b.StartDate.Date <= date.Date 
                && b.EndDate.Date >= date.Date)
            .ToList();

        // Build playlist - ONE ITEM PER SLOT (player will loop these)
        var playlist = new List<PlaylistItemResponse>();
        
        // Calculate duration per slot in seconds
        // TimeFrameMinutes is the duration for the entire rotation
        // Each slot gets TimeFrameMinutes * 60 / SlotsPerFrame seconds
        var durationPerSlot = (int)((screen.TimeFrameMinutes * 60.0) / screen.SlotsPerFrame);
        
        int bookedSlots = 0;
        int fillerSlots = 0;

        // Generate one playlist item per slot
        for (int slotNumber = 1; slotNumber <= screen.SlotsPerFrame; slotNumber++)
        {
            // PRIORITY 1: Check for owner content in this slot
            var ownerContent = ownerContentItems.FirstOrDefault(oc => oc.SlotNumber == slotNumber);
            
            if (ownerContent != null)
            {
                // Owner content takes precedence
                playlist.Add(new PlaylistItemResponse
                {
                    StartTime = daySchedule.StartTime.ToString(@"hh\:mm"),
                    EndTime = daySchedule.EndTime.ToString(@"hh\:mm"),
                    SlotNumber = slotNumber,
                    BookingId = null,
                    CampaignId = null,
                    CreativeId = null,
                    CreativeUrl = ownerContent.FileUrl,
                    CreativeMimeType = ownerContent.MimeType,
                    DurationSeconds = ownerContent.Duration > 0 ? ownerContent.Duration : durationPerSlot,
                    ImpressionId = Guid.NewGuid(),
                    IsFillerContent = false,
                    OwnerContentId = ownerContent.Id // Important for player to recognize
                });
                
                bookedSlots++;
                continue; // Skip booking check for this slot
            }
            
            // PRIORITY 2: Find booking that owns this slot on this date
            var booking = FindBookingForSlot(relevantBookings, date, slotNumber);

            if (booking != null)
            {
                // Fetch creative for this booking
                var creative = await _creativeRepository.GetByIdAsync(booking.CreativeId, cancellationToken);
                
                playlist.Add(new PlaylistItemResponse
                {
                    StartTime = daySchedule.StartTime.ToString(@"hh\:mm"),
                    EndTime = daySchedule.EndTime.ToString(@"hh\:mm"),
                    SlotNumber = slotNumber,
                    BookingId = booking.Id,
                    CampaignId = booking.CampaignId,
                    CreativeId = booking.CreativeId,
                    CreativeUrl = creative?.FileUrl ?? "",
                    CreativeMimeType = creative?.MimeType ?? "video/mp4",
                    DurationSeconds = durationPerSlot,
                    ImpressionId = Guid.NewGuid(),
                    IsFillerContent = false
                });
                
                bookedSlots++;
            }
            else
            {
                // No booking - use default video (custom or universal)
                var defaultVideoUrl = screen.HasCustomDefaultVideo && !string.IsNullOrEmpty(screen.DefaultVideoUrl)
                    ? screen.DefaultVideoUrl
                    : "/defaults/universal-default.mp4"; // Universal fallback
                
                playlist.Add(new PlaylistItemResponse
                {
                    StartTime = daySchedule.StartTime.ToString(@"hh\:mm"),
                    EndTime = daySchedule.EndTime.ToString(@"hh\:mm"),
                    SlotNumber = slotNumber,
                    BookingId = null,
                    CampaignId = null,
                    CreativeId = null,
                    CreativeUrl = defaultVideoUrl,
                    CreativeMimeType = "video/mp4",
                    DurationSeconds = durationPerSlot,
                    ImpressionId = Guid.NewGuid(),
                    IsFillerContent = true
                });
                
                fillerSlots++;
            }
        }

        // DEBUG: Log what we generated
        _logger.LogInformation($"[PLAYLIST DEBUG] Generated {playlist.Count} items for screen {screenId}");
        foreach (var item in playlist)
        {
            var typeStr = item.OwnerContentId.HasValue ? "OwnerContent" : 
                         item.BookingId.HasValue ? "Booking" : "Default";
            _logger.LogInformation($"  Slot {item.SlotNumber}: {typeStr} - URL: {item.CreativeUrl}");
        }

        return new PlaylistResponse
        {
            ScreenId = screenId,
            ScreenName = screen.Name,
            Date = date,
            OperatingStart = daySchedule.StartTime.ToString(@"hh\:mm"),
            OperatingEnd = daySchedule.EndTime.ToString(@"hh\:mm"),
            TimeFrameMinutes = screen.TimeFrameMinutes,
            SlotsPerFrame = screen.SlotsPerFrame,
            Playlist = playlist,
            TotalSlots = screen.SlotsPerFrame,
            BookedSlots = bookedSlots,
            FillerSlots = fillerSlots
        };
    }

    private Booking? FindBookingForSlot(List<Booking> bookings, DateTime date, int slotNumber)
    {
        foreach (var booking in bookings)
        {
            if (DailySlotAssignmentsHelper.HasSlotOnDate(
                booking.DailySlotAssignmentsJson, date, slotNumber))
            {
                return booking;
            }
        }

        return null;
    }
}
