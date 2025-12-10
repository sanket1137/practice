using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.ValueObjects;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Services;

public class RevenueCalculationService : IRevenueCalculationService
{
    public RevenueEstimateDto CalculateRevenueEstimate(Screen screen)
    {
        // CORRECTED FORMULA
        // Revenue per frame = price_per_slot_per_minute × time_frame_minutes
        var revenuePerFrame = screen.PricePerSlot * screen.TimeFrameMinutes;
        
        // Frames per hour
        var framesPerHour = 60m / screen.TimeFrameMinutes;
        
        // Revenue per hour
        var revenuePerHour = framesPerHour * revenuePerFrame;

        var dailyBreakdown = new Dictionary<string, decimal>
        {
            { "monday", CalculateDailyRevenue(screen.Schedule.Monday, revenuePerFrame, screen.TimeFrameMinutes) },
            { "tuesday", CalculateDailyRevenue(screen.Schedule.Tuesday, revenuePerFrame, screen.TimeFrameMinutes) },
            { "wednesday", CalculateDailyRevenue(screen.Schedule.Wednesday, revenuePerFrame, screen.TimeFrameMinutes) },
            { "thursday", CalculateDailyRevenue(screen.Schedule.Thursday, revenuePerFrame, screen.TimeFrameMinutes) },
            { "friday", CalculateDailyRevenue(screen.Schedule.Friday, revenuePerFrame, screen.TimeFrameMinutes) },
            { "saturday", CalculateDailyRevenue(screen.Schedule.Saturday, revenuePerFrame, screen.TimeFrameMinutes) },
            { "sunday", CalculateDailyRevenue(screen.Schedule.Sunday, revenuePerFrame, screen.TimeFrameMinutes) }
        };

        var weeklyRevenue = dailyBreakdown.Values.Sum();
        var monthlyRevenue = weeklyRevenue * 4.33m; // Average weeks per month

        return new RevenueEstimateDto
        {
            PerFrame = revenuePerFrame,
            PerHour = revenuePerHour,
            Daily = dailyBreakdown,
            Weekly = weeklyRevenue,
            Monthly = monthlyRevenue,
            
            // Deprecated but kept for backward compatibility
            PerMinute = revenuePerFrame / screen.TimeFrameMinutes
        };
    }

    public decimal CalculateDailyRevenue(DaySchedule schedule, decimal revenuePerFrame, int timeFrameMinutes)
    {
        if (!schedule.IsOperating)
            return 0;

        var operatingMinutes = (decimal)(schedule.EndTime - schedule.StartTime).TotalMinutes;
        
        // Handle midnight crossover (e.g., 23:00 to 01:00)
        if (operatingMinutes < 0)
            operatingMinutes += 24 * 60; // Add 24 hours in minutes

        // Number of frames (complete cycles) in the day
        var framesPerDay = operatingMinutes / timeFrameMinutes;
        
        return revenuePerFrame * framesPerDay;
    }
}
