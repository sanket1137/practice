using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using System.Text.Json;

namespace CCMS.Domain.Factories;

/// <summary>
/// Factory for creating Booking entities with standardized formats
/// </summary>
public static class BookingFactory
{
    /// <summary>
    /// Create booking with standardized DailySlotAssignmentsJson in correct format
    /// Ensures UTC dates and proper JSON structure
    /// </summary>
    public static Booking CreateWithDailyAssignments(
        Guid screenId,
        Guid campaignId,
        Guid creativeId,
        DateTime startDate,
        DateTime endDate,
        List<int> slotNumbers)
    {
        // Validate inputs
        if (screenId == Guid.Empty)
            throw new ArgumentException("ScreenId cannot be empty", nameof(screenId));
        if (campaignId == Guid.Empty)
            throw new ArgumentException("CampaignId cannot be empty", nameof(campaignId));
        if (creativeId == Guid.Empty)
            throw new ArgumentException("CreativeId cannot be empty", nameof(creativeId));
        if (slotNumbers == null || !slotNumbers.Any())
            throw new ArgumentException("At least one slot number must be specified", nameof(slotNumbers));
        if (startDate > endDate)
            throw new ArgumentException("StartDate must be before or equal to EndDate");
        
        // Generate daily assignments in STANDARD format
        var dailyAssignments = GenerateDailyAssignments(startDate, endDate, slotNumbers);
        
        return new Booking
        {
            Id = Guid.NewGuid(),
            ScreenId = screenId,
            CampaignId = campaignId,
            CreativeId = creativeId,
            StartDate = startDate.ToUniversalTime(), // Always UTC
            EndDate = endDate.ToUniversalTime(),
            Status = BookingStatus.Pending,
            SlotNumbers = slotNumbers,
            DailySlotAssignmentsJson = CreateDailySlotAssignmentsJson(dailyAssignments),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = null,
            IsDeleted = false
        };
    }
    
    /// <summary>
    /// Create JSON in standard format {"yyyy-MM-dd": [slots]}
    /// </summary>
    private static string CreateDailySlotAssignmentsJson(Dictionary<DateTime, List<int>> assignments)
    {
        var normalized = assignments.ToDictionary(
            kvp => kvp.Key.ToString("yyyy-MM-dd"),
            kvp => kvp.Value
        );
        return JsonSerializer.Serialize(normalized);
    }
    
    /// <summary>
    /// Generate daily slot assignments for date range
    /// Each day gets a copy of the slot numbers
    /// </summary>
    private static Dictionary<DateTime, List<int>> GenerateDailyAssignments(
        DateTime start, DateTime end, List<int> slots)
    {
        var assignments = new Dictionary<DateTime, List<int>>();
        
        for (var date = start.Date; date <= end.Date; date = date.AddDays(1))
        {
            // Create a new list for each day (don't share references)
            assignments[date] = new List<int>(slots);
        }
        
        return assignments;
    }
    
    /// <summary>
    /// Create booking with rotating daily slot assignments
    /// Useful for campaigns that rotate through different slots each day
    /// </summary>
    public static Booking CreateWithRotatingSlots(
        Guid screenId,
        Guid campaignId,
        Guid creativeId,
        DateTime startDate,
        DateTime endDate,
        Dictionary<DateTime, List<int>> dailySlotAssignments)
    {
        // Validate inputs
        if (dailySlotAssignments == null || !dailySlotAssignments.Any())
            throw new ArgumentException("Daily slot assignments must be specified", nameof(dailySlotAssignments));
        
        // Get all unique slots from assignments
        var allSlots = dailySlotAssignments
            .SelectMany(kvp => kvp.Value)
            .Distinct()
            .OrderBy(s => s)
            .ToList();
        
        return new Booking
        {
            Id = Guid.NewGuid(),
            ScreenId = screenId,
            CampaignId = campaignId,
            CreativeId = creativeId,
            StartDate = startDate.ToUniversalTime(),
            EndDate = endDate.ToUniversalTime(),
            Status = BookingStatus.Pending,
            SlotNumbers = allSlots, // All slots that are used across all days
            DailySlotAssignmentsJson = CreateDailySlotAssignmentsJson(dailySlotAssignments),
            CreatedAt = DateTime.UtcNow,
            IsDeleted = false
        };
    }
}
