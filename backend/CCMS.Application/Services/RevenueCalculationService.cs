using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.ValueObjects;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Services;

public class RevenueCalculationService : IRevenueCalculationService
{
    public RevenueEstimateDto CalculateRevenueEstimate(Screen screen)
    {
        var revenuePerMinute = screen.SlotsPerFrame * screen.PricePerSlot;
        var revenuePerHour = revenuePerMinute * 60;

        var dailyBreakdown = new Dictionary<string, decimal>
        {
            { "monday", CalculateDailyRevenue(screen.Schedule.Monday, revenuePerMinute) },
            { "tuesday", CalculateDailyRevenue(screen.Schedule.Tuesday, revenuePerMinute) },
            { "wednesday", CalculateDailyRevenue(screen.Schedule.Wednesday, revenuePerMinute) },
            { "thursday", CalculateDailyRevenue(screen.Schedule.Thursday, revenuePerMinute) },
            { "friday", CalculateDailyRevenue(screen.Schedule.Friday, revenuePerMinute) },
            { "saturday", CalculateDailyRevenue(screen.Schedule.Saturday, revenuePerMinute) },
            { "sunday", CalculateDailyRevenue(screen.Schedule.Sunday, revenuePerMinute) }
        };

        var weeklyRevenue = dailyBreakdown.Values.Sum();
        var monthlyRevenue = weeklyRevenue * 4.33m; // Average weeks per month

        return new RevenueEstimateDto
        {
            PerMinute = revenuePerMinute,
            PerHour = revenuePerHour,
            Daily = dailyBreakdown,
            Weekly = weeklyRevenue,
            Monthly = monthlyRevenue
        };
    }

    public decimal CalculateDailyRevenue(DaySchedule schedule, decimal revenuePerMinute)
    {
        if (!schedule.IsOperating)
            return 0;

        var operatingMinutes = (decimal)(schedule.EndTime - schedule.StartTime).TotalMinutes;
        
        // Handle midnight crossover (e.g., 23:00 to 01:00)
        if (operatingMinutes < 0)
            operatingMinutes += 24 * 60; // Add 24 hours in minutes

        return revenuePerMinute * operatingMinutes;
    }
}
