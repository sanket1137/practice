using CCMS.Domain.Entities;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Interfaces;

public interface IRevenueCalculationService
{
    RevenueEstimateDto CalculateRevenueEstimate(Screen screen);
    decimal CalculateDailyRevenue(Domain.ValueObjects.DaySchedule schedule, decimal revenuePerMinute);
}
