using CCMS.Domain.Entities;
using CCMS.Domain.ValueObjects;

namespace CCMS.Application.Services;

public class BookingCalculationService
{
    public BookingCalculation CalculateBooking(
        Screen screen, 
        DateTime startDate, 
        DateTime endDate)
    {
        var calculation = new BookingCalculation();
        var currentDate = startDate.Date;
        
        while (currentDate <= endDate.Date)
        {
            var dayOfWeek = currentDate.DayOfWeek;
            var daySchedule = GetDaySchedule(screen.Schedule, dayOfWeek);
            
            if (daySchedule?.IsOperating == true)
            {
                var operatingMinutes = CalculateOperatingMinutes(daySchedule);
                var framesPerDay = operatingMinutes / screen.TimeFrameMinutes;
                var playsPerDay = framesPerDay; // 1 slot per frame per advertiser
                
                calculation.DailyBreakdown.Add(new DailyCalculation
                {
                    Date = currentDate,
                    DayOfWeek = dayOfWeek.ToString(),
                    OperatingHours = operatingMinutes / 60.0,
                    Frames = framesPerDay,
                    ExpectedPlays = playsPerDay
                });
                
                calculation.TotalFrames += framesPerDay;
                calculation.TotalExpectedImpressions += playsPerDay;
            }
            
            currentDate = currentDate.AddDays(1);
        }
        
        calculation.TotalDays = (int)(endDate.Date - startDate.Date).TotalDays + 1;
        calculation.OperatingDays = calculation.DailyBreakdown.Count;
        
        return calculation;
    }
    
    private DaySchedule? GetDaySchedule(OperatingSchedule schedule, DayOfWeek dayOfWeek)
    {
        return dayOfWeek switch
        {
            DayOfWeek.Monday => schedule.Monday,
            DayOfWeek.Tuesday => schedule.Tuesday,
            DayOfWeek.Wednesday => schedule.Wednesday,
            DayOfWeek.Thursday => schedule.Thursday,
            DayOfWeek.Friday => schedule.Friday,
            DayOfWeek.Saturday => schedule.Saturday,
            DayOfWeek.Sunday => schedule.Sunday,
            _ => null
        };
    }
    
    private int CalculateOperatingMinutes(DaySchedule daySchedule)
    {
        return (int)(daySchedule.EndTime - daySchedule.StartTime).TotalMinutes;
    }
}

public class BookingCalculation
{
    public int TotalDays { get; set; }
    public int OperatingDays { get; set; }
    public int TotalFrames { get; set; }
    public int TotalExpectedImpressions { get; set; }
    public List<DailyCalculation> DailyBreakdown { get; set; } = new();
}

public class DailyCalculation
{
    public DateTime Date { get; set; }
    public string DayOfWeek { get; set; } = string.Empty;
    public double OperatingHours { get; set; }
    public int Frames { get; set; }
    public int ExpectedPlays { get; set; }
}
