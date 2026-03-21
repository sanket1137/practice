using CCMS.Domain.ValueObjects;
using FluentAssertions;

namespace CCMS.Tests.Domain;

public class OperatingScheduleTests
{
    [Fact]
    public void DaySchedule_GetOperatingHours_WhenOperating_ReturnsCorrectHours()
    {
        var schedule = new DaySchedule
        {
            StartTime = TimeSpan.FromHours(9),
            EndTime = TimeSpan.FromHours(21),
            IsOperating = true,
        };

        schedule.GetOperatingHours().Should().Be(12);
    }

    [Fact]
    public void DaySchedule_GetOperatingHours_WhenNotOperating_ReturnsZero()
    {
        var schedule = new DaySchedule
        {
            StartTime = TimeSpan.FromHours(9),
            EndTime = TimeSpan.FromHours(21),
            IsOperating = false,
        };

        schedule.GetOperatingHours().Should().Be(0);
    }

    [Fact]
    public void GetAverageOperatingHoursPerDay_AllDaysOperating_ReturnsAverage()
    {
        var schedule = CreateUniformSchedule(
            TimeSpan.FromHours(8), TimeSpan.FromHours(20), operating: true);

        schedule.GetAverageOperatingHoursPerDay().Should().Be(12);
    }

    [Fact]
    public void GetAverageOperatingHoursPerDay_NoDaysOperating_ReturnsZero()
    {
        var schedule = new OperatingSchedule(); // defaults: all not operating

        schedule.GetAverageOperatingHoursPerDay().Should().Be(0);
    }

    [Fact]
    public void GetAverageOperatingHoursPerDay_SomeDaysOperating_AveragesOnlyActiveDays()
    {
        var schedule = new OperatingSchedule
        {
            Monday = new DaySchedule { StartTime = TimeSpan.FromHours(9), EndTime = TimeSpan.FromHours(21), IsOperating = true },
            Tuesday = new DaySchedule { StartTime = TimeSpan.FromHours(9), EndTime = TimeSpan.FromHours(21), IsOperating = true },
            Wednesday = new DaySchedule { IsOperating = false },
            Thursday = new DaySchedule { IsOperating = false },
            Friday = new DaySchedule { IsOperating = false },
            Saturday = new DaySchedule { IsOperating = false },
            Sunday = new DaySchedule { IsOperating = false },
        };

        // Only Mon+Tue operating at 12h each → average = 12
        schedule.GetAverageOperatingHoursPerDay().Should().Be(12);
    }

    [Theory]
    [InlineData(DayOfWeek.Monday)]
    [InlineData(DayOfWeek.Tuesday)]
    [InlineData(DayOfWeek.Wednesday)]
    [InlineData(DayOfWeek.Thursday)]
    [InlineData(DayOfWeek.Friday)]
    [InlineData(DayOfWeek.Saturday)]
    [InlineData(DayOfWeek.Sunday)]
    public void GetScheduleForDay_ReturnsCorrectDay(DayOfWeek day)
    {
        var schedule = CreateUniformSchedule(
            TimeSpan.FromHours(10), TimeSpan.FromHours(18), operating: true);

        var result = schedule.GetScheduleForDay(day);

        result.Should().NotBeNull();
        result.IsOperating.Should().BeTrue();
        result.StartTime.Should().Be(TimeSpan.FromHours(10));
    }

    private static OperatingSchedule CreateUniformSchedule(TimeSpan start, TimeSpan end, bool operating)
    {
        DaySchedule create() => new() { StartTime = start, EndTime = end, IsOperating = operating };
        return new OperatingSchedule
        {
            Monday = create(),
            Tuesday = create(),
            Wednesday = create(),
            Thursday = create(),
            Friday = create(),
            Saturday = create(),
            Sunday = create(),
        };
    }
}
