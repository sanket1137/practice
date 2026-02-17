using Microsoft.AspNetCore.Mvc;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.Common;

namespace CCMS.Api.Controllers;

[ApiController]
[Route("api/player")]
public class CacheCleanupController : ControllerBase
{
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly ILogger<CacheCleanupController> _logger;

    public CacheCleanupController(
        IRepository<Booking> bookingRepository,
        IRepository<Screen> screenRepository,
        ILogger<CacheCleanupController> logger)
    {
        _bookingRepository = bookingRepository;
        _screenRepository = screenRepository;
        _logger = logger;
    }

    /// <summary>
    /// Get list of expired bookings that can be safely removed from cache
    /// </summary>
    [HttpGet("expired-cache/{screenId}")]
    public async Task<ActionResult<ApiResponse<ExpiredCacheResponse>>> GetExpiredCache(Guid screenId)
    {
        try
        {
            var screen = await _screenRepository.GetByIdAsync(screenId);
            if (screen == null)
            {
                return NotFound(ApiResponse<ExpiredCacheResponse>.ErrorResponse("Screen not found"));
            }

            var now = DateTime.UtcNow;
            var allBookings = await _bookingRepository.GetAllAsync();
            
            // Get bookings for this screen
            var screenBookings = allBookings
                .Where(b => b.ScreenId == screenId)
                .ToList();

            var expiredBookings = new List<ExpiredBookingInfo>();

            foreach (var booking in screenBookings)
            {
                // Check if booking has truly expired
                if (IsBookingExpired(booking, screen, now))
                {
                    expiredBookings.Add(new ExpiredBookingInfo
                    {
                        BookingId = booking.Id,
                        CampaignId = booking.CampaignId,
                        EndDate = booking.EndDate.ToDateTime(TimeOnly.MaxValue),
                        SafeToDelete = true
                    });
                }
            }

            _logger.LogInformation(
                "Cache cleanup check for screen {ScreenId}: {Count} expired bookings found",
                screenId, expiredBookings.Count);

            return Ok(ApiResponse<ExpiredCacheResponse>.SuccessResponse(new ExpiredCacheResponse
            {
                ScreenId = screenId,
                ExpiredBookings = expiredBookings,
                CheckedAt = now
            }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking expired cache for screen {ScreenId}", screenId);
            return StatusCode(500, ApiResponse<ExpiredCacheResponse>.ErrorResponse(
                "Failed to check expired cache"));
        }
    }

    private bool IsBookingExpired(Booking booking, Screen screen, DateTime now)
    {
        // Conservative approach: booking is expired if EndDate was at least 1 day ago
        // This ensures videos are kept throughout all operating hours on the end date itself,
        // plus the entire following day for overnight operations
        
        var endDatePlusBuffer = booking.EndDate.AddDays(1);
        var today = DateOnly.FromDateTime(now);
        
        // Only safe to delete if we're past the end date + 1 full day
        return today > endDatePlusBuffer;
    }
}

public class ExpiredCacheResponse
{
    public Guid ScreenId { get; set; }
    public List<ExpiredBookingInfo> ExpiredBookings { get; set; } = new();
    public DateTime CheckedAt { get; set; }
}

public class ExpiredBookingInfo
{
    public Guid BookingId { get; set; }
    public Guid CampaignId { get; set; }
    public DateTime EndDate { get; set; }
    public bool SafeToDelete { get; set; }
}
