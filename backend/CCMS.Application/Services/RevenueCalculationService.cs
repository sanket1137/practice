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
        
        // Slot duration
        var slotDurationSeconds = screen.SlotsPerFrame > 0
            ? (screen.TimeFrameMinutes * 60) / screen.SlotsPerFrame
            : 0;

        // Build day breakdowns with slot/frame counts
        var dayMap = new (string Name, DaySchedule Sched)[]
        {
            ("monday", screen.Schedule.Monday),
            ("tuesday", screen.Schedule.Tuesday),
            ("wednesday", screen.Schedule.Wednesday),
            ("thursday", screen.Schedule.Thursday),
            ("friday", screen.Schedule.Friday),
            ("saturday", screen.Schedule.Saturday),
            ("sunday", screen.Schedule.Sunday),
        };

        var dailyBreakdown = new Dictionary<string, DayBreakdownDto>();
        var dailyLegacy = new Dictionary<string, decimal>();
        var totalWeeklySlotPlays = 0;

        foreach (var (name, sched) in dayMap)
        {
            var breakdown = CalculateDayBreakdown(sched, revenuePerFrame, screen.TimeFrameMinutes, screen.SlotsPerFrame);
            dailyBreakdown[name] = breakdown;
            dailyLegacy[name] = breakdown.Revenue;
            totalWeeklySlotPlays += breakdown.TotalSlotPlays;
        }

        var weeklyRevenue = dailyBreakdown.Values.Sum(d => d.Revenue);
        var monthlyRevenue = weeklyRevenue * 4.33m; // Average weeks per month

        return new RevenueEstimateDto
        {
            PerFrame = revenuePerFrame,
            PerHour = revenuePerHour,
            DailyBreakdown = dailyBreakdown,
            Daily = dailyLegacy,
            Weekly = weeklyRevenue,
            Monthly = monthlyRevenue,
            SlotDurationSeconds = slotDurationSeconds,
            TotalWeeklySlotPlays = totalWeeklySlotPlays,
            
            // Deprecated but kept for backward compatibility
            PerMinute = screen.TimeFrameMinutes > 0 ? revenuePerFrame / screen.TimeFrameMinutes : 0
        };
    }

    private DayBreakdownDto CalculateDayBreakdown(DaySchedule schedule, decimal revenuePerFrame, int timeFrameMinutes, int slotsPerFrame)
    {
        if (!schedule.IsOperating)
        {
            return new DayBreakdownDto
            {
                IsOperating = false,
                OperatingHours = "Closed",
                OperatingHoursDecimal = 0,
                FramesPerDay = 0,
                TotalSlotPlays = 0,
                Revenue = 0
            };
        }

        var operatingMinutes = (decimal)(schedule.EndTime - schedule.StartTime).TotalMinutes;
        
        // Handle midnight crossover (e.g., 23:00 to 01:00)
        if (operatingMinutes < 0)
            operatingMinutes += 24 * 60;

        var operatingHours = operatingMinutes / 60m;
        var framesPerDay = (int)(operatingMinutes / timeFrameMinutes);
        var totalSlotPlays = framesPerDay * slotsPerFrame;
        var revenue = revenuePerFrame * framesPerDay;

        return new DayBreakdownDto
        {
            IsOperating = true,
            OperatingHours = $"{schedule.StartTime:hh\\:mm}–{schedule.EndTime:hh\\:mm}",
            OperatingHoursDecimal = Math.Round(operatingHours, 1),
            FramesPerDay = framesPerDay,
            TotalSlotPlays = totalSlotPlays,
            Revenue = revenue
        };
    }

    public decimal CalculateDailyRevenue(DaySchedule schedule, decimal revenuePerFrame, int timeFrameMinutes)
    {
        return CalculateDayBreakdown(schedule, revenuePerFrame, timeFrameMinutes, 1).Revenue;
    }
}
