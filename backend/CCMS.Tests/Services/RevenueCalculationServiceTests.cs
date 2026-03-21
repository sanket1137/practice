using CCMS.Application.Services;
using CCMS.Domain.Entities;
using CCMS.Domain.ValueObjects;
using FluentAssertions;

namespace CCMS.Tests.Services;

public class RevenueCalculationServiceTests
{
    private readonly RevenueCalculationService _sut = new();

    private static Screen CreateScreen(decimal pricePerSlot, int timeFrameMinutes, int slotsPerFrame, OperatingSchedule? schedule = null)
    {
        return new Screen
        {
            PricePerSlot = pricePerSlot,
            TimeFrameMinutes = timeFrameMinutes,
            SlotsPerFrame = slotsPerFrame,
            Schedule = schedule ?? CreateAllDaySchedule(),
        };
    }

    private static OperatingSchedule CreateAllDaySchedule()
    {
        DaySchedule create() => new() { StartTime = TimeSpan.FromHours(9), EndTime = TimeSpan.FromHours(21), IsOperating = true };
        return new OperatingSchedule
        {
            Monday = create(), Tuesday = create(), Wednesday = create(),
            Thursday = create(), Friday = create(), Saturday = create(), Sunday = create(),
        };
    }

    [Fact]
    public void CalculateRevenueEstimate_BasicScreen_CalculatesCorrectly()
    {
        // 10 INR/slot, 10-minute frames, 6 slots per frame
        // Operating 9am-9pm = 12 hours = 720 minutes
        // Frames per day = 720 / 10 = 72
        // Revenue per frame = 10 * 10 = 100
        // Daily revenue = 72 * 100 = 7200
        // Weekly = 7200 * 7 = 50400
        var screen = CreateScreen(pricePerSlot: 10, timeFrameMinutes: 10, slotsPerFrame: 6);

        var result = _sut.CalculateRevenueEstimate(screen);

        result.PerFrame.Should().Be(100m); // pricePerSlot * timeFrameMinutes
        result.Weekly.Should().Be(50400m);
        result.Monthly.Should().Be(50400m * 4.33m);
        result.SlotDurationSeconds.Should().Be(100); // (10*60)/6 = 100
        result.DailyBreakdown.Should().HaveCount(7);
        result.DailyBreakdown["monday"].FramesPerDay.Should().Be(72);
        result.DailyBreakdown["monday"].Revenue.Should().Be(7200m);
        result.DailyBreakdown["monday"].TotalSlotPlays.Should().Be(72 * 6);
    }

    [Fact]
    public void CalculateRevenueEstimate_ClosedDay_HasZeroRevenue()
    {
        var schedule = CreateAllDaySchedule();
        schedule.Sunday = new DaySchedule { IsOperating = false };
        var screen = CreateScreen(10, 10, 6, schedule);

        var result = _sut.CalculateRevenueEstimate(screen);

        result.DailyBreakdown["sunday"].IsOperating.Should().BeFalse();
        result.DailyBreakdown["sunday"].Revenue.Should().Be(0);
        result.DailyBreakdown["sunday"].FramesPerDay.Should().Be(0);
    }

    [Fact]
    public void CalculateRevenueEstimate_ZeroSlotsPerFrame_HandlesGracefully()
    {
        var screen = CreateScreen(10, 10, slotsPerFrame: 0);

        var result = _sut.CalculateRevenueEstimate(screen);

        result.SlotDurationSeconds.Should().Be(0);
    }

    [Fact]
    public void CalculateDailyRevenue_OperatingDay_ReturnsCorrectAmount()
    {
        var day = new DaySchedule
        {
            StartTime = TimeSpan.FromHours(8),
            EndTime = TimeSpan.FromHours(20),
            IsOperating = true,
        };

        // 12 hours = 720 min, frames = 720/15 = 48, revenue = 50*48 = 2400
        var result = _sut.CalculateDailyRevenue(day, revenuePerFrame: 50, timeFrameMinutes: 15);

        result.Should().Be(2400m);
    }

    [Fact]
    public void CalculateDailyRevenue_ClosedDay_ReturnsZero()
    {
        var day = new DaySchedule { IsOperating = false };

        var result = _sut.CalculateDailyRevenue(day, revenuePerFrame: 50, timeFrameMinutes: 15);

        result.Should().Be(0);
    }

    [Fact]
    public void CalculateRevenueEstimate_TotalWeeklySlotPlays_SumsAllDays()
    {
        var screen = CreateScreen(5, 10, 4); // 4 slots per frame

        var result = _sut.CalculateRevenueEstimate(screen);

        // Each day: 720min / 10 = 72 frames, 72*4 = 288 slot plays,  7 days = 2016
        result.TotalWeeklySlotPlays.Should().Be(2016);
    }
}
