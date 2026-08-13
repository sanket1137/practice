using CCMS.Application.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace CCMS.Functions;

/// <summary>
/// Azure Function that updates booking statuses on a schedule.
/// This is an alternative to the background service for serverless deployments.
/// </summary>
public class BookingStatusUpdateFunction
{
    private readonly BookingStatusUpdateService _bookingStatusService;
    private readonly ILogger<BookingStatusUpdateFunction> _logger;

    public BookingStatusUpdateFunction(
        BookingStatusUpdateService bookingStatusService,
        ILogger<BookingStatusUpdateFunction> logger)
    {
        _bookingStatusService = bookingStatusService;
        _logger = logger;
    }

    /// <summary>
    /// Timer trigger function that runs every 15 minutes.
    /// Handles booking status transitions, payment expiry, and refund status polling.
    /// Schedule format: "seconds minutes hours day month day-of-week"
    /// "0 */15 * * * *" = every 15 minutes
    /// </summary>
    /// <param name="timer">Timer information</param>
    [Function("BookingStatusUpdateFunction")]
    public async Task Run(
        [TimerTrigger("0 */15 * * * *")] TimerInfo timer)
    {
        _logger.LogInformation("Booking status update function triggered at: {Time}", DateTime.Now);

        try
        {
            var updatedCount = await _bookingStatusService.UpdateBookingStatusesAsync();
            
            _logger.LogInformation(
                "Booking status update completed. Updated {Count} booking(s). Next run: {NextRun}", 
                updatedCount, 
                timer.ScheduleStatus?.Next);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating booking statuses in Azure Function");
            throw;
        }
    }
}
