namespace CCMS.Domain.ValueObjects;

public class DaySchedule
{
    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }
    public bool IsOperating { get; set; }
    
    public double GetOperatingHours()
    {
        if (!IsOperating) return 0;
        return (EndTime - StartTime).TotalHours;
    }
}

public class OperatingSchedule
{
    public DaySchedule Monday { get; set; } = new();
    public DaySchedule Tuesday { get; set; } = new();
    public DaySchedule Wednesday { get; set; } = new();
    public DaySchedule Thursday { get; set; } = new();
    public DaySchedule Friday { get; set; } = new();
    public DaySchedule Saturday { get; set; } = new();
    public DaySchedule Sunday { get; set; } = new();
    
    public double GetAverageOperatingHoursPerDay()
    {
        var schedules = new[] { Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday };
        var totalHours = schedules.Sum(s => s.GetOperatingHours());
        var operatingDays = schedules.Count(s => s.IsOperating);
        
        return operatingDays > 0 ? totalHours / operatingDays : 0;
    }
    
    public DaySchedule GetScheduleForDay(DayOfWeek day)
    {
        return day switch
        {
            DayOfWeek.Monday => Monday,
            DayOfWeek.Tuesday => Tuesday,
            DayOfWeek.Wednesday => Wednesday,
            DayOfWeek.Thursday => Thursday,
            DayOfWeek.Friday => Friday,
            DayOfWeek.Saturday => Saturday,
            DayOfWeek.Sunday => Sunday,
            _ => new DaySchedule()
        };
    }
}
