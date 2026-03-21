using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Helpers;
using FluentAssertions;

namespace CCMS.Tests.Domain;

public class BookingStatusHelperTests
{
    [Fact]
    public void GetActiveStatuses_ReturnsApprovedAndActive()
    {
        var result = BookingStatusHelper.GetActiveStatuses();

        result.Should().BeEquivalentTo(new[] { BookingStatus.Approved, BookingStatus.Active });
    }

    [Theory]
    [InlineData(BookingStatus.Approved, true)]
    [InlineData(BookingStatus.Active, true)]
    [InlineData(BookingStatus.Pending, false)]
    [InlineData(BookingStatus.Cancelled, false)]
    [InlineData(BookingStatus.Rejected, false)]
    [InlineData(BookingStatus.Completed, false)]
    public void IsActiveForPlaylist_ReturnsExpected(BookingStatus status, bool expected)
    {
        status.IsActiveForPlaylist().Should().Be(expected);
    }

    [Theory]
    [InlineData(BookingStatus.Pending, true)]
    [InlineData(BookingStatus.Approved, true)]
    [InlineData(BookingStatus.Active, true)]
    [InlineData(BookingStatus.Cancelled, false)]
    [InlineData(BookingStatus.Rejected, false)]
    [InlineData(BookingStatus.Completed, false)]
    public void CanCancel_ReturnsExpected(BookingStatus status, bool expected)
    {
        status.CanCancel().Should().Be(expected);
    }

    [Theory]
    [InlineData(BookingStatus.Pending, true)]
    [InlineData(BookingStatus.Approved, true)]
    [InlineData(BookingStatus.Active, false)]
    [InlineData(BookingStatus.Cancelled, false)]
    [InlineData(BookingStatus.Rejected, false)]
    [InlineData(BookingStatus.Completed, false)]
    public void CanEdit_ReturnsExpected(BookingStatus status, bool expected)
    {
        status.CanEdit().Should().Be(expected);
    }

    [Theory]
    [InlineData(BookingStatus.Pending, "Pending Approval")]
    [InlineData(BookingStatus.Approved, "Approved (Scheduled)")]
    [InlineData(BookingStatus.Active, "Active (Playing Now)")]
    [InlineData(BookingStatus.Completed, "Completed")]
    [InlineData(BookingStatus.Cancelled, "Cancelled")]
    [InlineData(BookingStatus.Rejected, "Rejected")]
    public void GetDisplayName_ReturnsExpected(BookingStatus status, string expected)
    {
        status.GetDisplayName().Should().Be(expected);
    }

    [Fact]
    public void IsActiveOn_ApprovedBooking_WithinDateRange_ReturnsTrue()
    {
        var booking = new Booking
        {
            Status = BookingStatus.Approved,
            StartDate = new DateOnly(2026, 3, 1),
            EndDate = new DateOnly(2026, 3, 31),
        };

        booking.IsActiveOn(new DateTime(2026, 3, 15)).Should().BeTrue();
    }

    [Fact]
    public void IsActiveOn_ApprovedBooking_OutsideDateRange_ReturnsFalse()
    {
        var booking = new Booking
        {
            Status = BookingStatus.Approved,
            StartDate = new DateOnly(2026, 3, 1),
            EndDate = new DateOnly(2026, 3, 31),
        };

        booking.IsActiveOn(new DateTime(2026, 4, 5)).Should().BeFalse();
    }

    [Fact]
    public void IsActiveOn_CancelledBooking_WithinDateRange_ReturnsFalse()
    {
        var booking = new Booking
        {
            Status = BookingStatus.Cancelled,
            StartDate = new DateOnly(2026, 3, 1),
            EndDate = new DateOnly(2026, 3, 31),
        };

        booking.IsActiveOn(new DateTime(2026, 3, 15)).Should().BeFalse();
    }

    [Fact]
    public void IsActiveOn_OnStartDate_ReturnsTrue()
    {
        var booking = new Booking
        {
            Status = BookingStatus.Active,
            StartDate = new DateOnly(2026, 3, 10),
            EndDate = new DateOnly(2026, 3, 20),
        };

        booking.IsActiveOn(new DateTime(2026, 3, 10)).Should().BeTrue();
    }

    [Fact]
    public void IsActiveOn_OnEndDate_ReturnsTrue()
    {
        var booking = new Booking
        {
            Status = BookingStatus.Active,
            StartDate = new DateOnly(2026, 3, 10),
            EndDate = new DateOnly(2026, 3, 20),
        };

        booking.IsActiveOn(new DateTime(2026, 3, 20)).Should().BeTrue();
    }
}
