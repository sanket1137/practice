using AutoMapper;
using CCMS.Application.Features.Bookings.Commands;
using CCMS.Application.Interfaces;
using CCMS.Application.Services;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Bookings;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using System.Linq.Expressions;

namespace CCMS.Tests.Handlers;

public class CancelBookingCommandHandlerTests
{
    private readonly Mock<IRepository<Booking>> _bookingRepo = new();
    private readonly Mock<IRepository<Screen>> _screenRepo = new();
    private readonly Mock<IRepository<Creative>> _creativeRepo = new();
    private readonly Mock<IRepository<Campaign>> _campaignRepo = new();
    private readonly Mock<SlotAvailabilityService> _slotService;
    private readonly Mock<IRazorpayService> _razorpayService = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IMapper> _mapper = new();
    private readonly Mock<IBookingNotificationService> _notificationService = new();
    private readonly Mock<ILogger<CancelBookingCommandHandler>> _logger = new();
    private readonly CancelBookingCommandHandler _sut;

    private readonly Guid _advertiserId = Guid.NewGuid();
    private readonly Guid _screenOwnerId = Guid.NewGuid();
    private readonly Guid _bookingId = Guid.NewGuid();

    public CancelBookingCommandHandlerTests()
    {
        // SlotAvailabilityService has constructor deps — mock them too
        var slotRepo = new Mock<IRepository<SlotAvailability>>();
        var screenRepoForSlot = new Mock<IRepository<Screen>>();
        var uowForSlot = new Mock<IUnitOfWork>();
        _slotService = new Mock<SlotAvailabilityService>(
            slotRepo.Object, screenRepoForSlot.Object, uowForSlot.Object)
        { CallBase = false };

        _sut = new CancelBookingCommandHandler(
            _bookingRepo.Object,
            _screenRepo.Object,
            _creativeRepo.Object,
            _campaignRepo.Object,
            _slotService.Object,
            _razorpayService.Object,
            _unitOfWork.Object,
            _mapper.Object,
            _notificationService.Object,
            _logger.Object);
    }

    private Booking CreateBooking(BookingStatus status = BookingStatus.Approved)
    {
        return new Booking
        {
            Id = _bookingId,
            ScreenId = Guid.NewGuid(),
            CampaignId = Guid.NewGuid(),
            CreativeId = Guid.NewGuid(),
            Status = status,
            StartDate = new DateOnly(2026, 4, 1),
            EndDate = new DateOnly(2026, 4, 30),
            TotalPrice = 5000m,
        };
    }

    private void SetupValidBooking(Booking booking)
    {
        _bookingRepo.Setup(r => r.GetByIdAsync(booking.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(booking);

        _campaignRepo.Setup(r => r.GetByIdAsync(booking.CampaignId!.Value, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Campaign { Id = booking.CampaignId.Value, AdvertiserId = _advertiserId, Name = "Test Campaign", Currency = "INR" });

        _screenRepo.Setup(r => r.GetByIdAsync(booking.ScreenId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Screen { Id = booking.ScreenId, OwnerId = _screenOwnerId });

        _creativeRepo.Setup(r => r.GetByIdAsync(booking.CreativeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Creative { Id = booking.CreativeId, IsLocked = true });

        // No other active bookings for this creative
        _bookingRepo.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Booking, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Enumerable.Empty<Booking>());

        _mapper.Setup(m => m.Map<BookingDto>(It.IsAny<Booking>()))
            .Returns(new BookingDto { Id = booking.Id });
    }

    [Fact]
    public async Task Handle_AdvertiserCancelsOwnBooking_Succeeds()
    {
        var booking = CreateBooking(BookingStatus.Approved);
        SetupValidBooking(booking);

        var command = new CancelBookingCommand(_bookingId, _advertiserId, "Changed plans");
        var result = await _sut.Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        booking.Status.Should().Be(BookingStatus.Cancelled);
        booking.CancelledBy.Should().Be(_advertiserId);
        booking.CancellationReason.Should().Be("Changed plans");
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ScreenOwnerCancelsBooking_Succeeds()
    {
        var booking = CreateBooking(BookingStatus.Active);
        SetupValidBooking(booking);

        var command = new CancelBookingCommand(_bookingId, _screenOwnerId, "Screen maintenance");
        var result = await _sut.Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        booking.Status.Should().Be(BookingStatus.Cancelled);
    }

    [Fact]
    public async Task Handle_PendingBooking_CanBeCancelled()
    {
        var booking = CreateBooking(BookingStatus.Pending);
        SetupValidBooking(booking);

        var command = new CancelBookingCommand(_bookingId, _advertiserId, null);
        var result = await _sut.Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        booking.Status.Should().Be(BookingStatus.Cancelled);
    }

    [Fact]
    public async Task Handle_CompletedBooking_ThrowsInvalidOperation()
    {
        var booking = CreateBooking(BookingStatus.Completed);
        SetupValidBooking(booking);

        var command = new CancelBookingCommand(_bookingId, _advertiserId, null);

        await _sut.Invoking(s => s.Handle(command, CancellationToken.None))
            .Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*cannot be cancelled*");
    }

    [Fact]
    public async Task Handle_RejectedBooking_ThrowsInvalidOperation()
    {
        var booking = CreateBooking(BookingStatus.Rejected);
        SetupValidBooking(booking);

        var command = new CancelBookingCommand(_bookingId, _advertiserId, null);

        await _sut.Invoking(s => s.Handle(command, CancellationToken.None))
            .Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task Handle_UnrelatedUser_ThrowsUnauthorized()
    {
        var booking = CreateBooking();
        SetupValidBooking(booking);

        var unrelatedUser = Guid.NewGuid();
        var command = new CancelBookingCommand(_bookingId, unrelatedUser, null);

        await _sut.Invoking(s => s.Handle(command, CancellationToken.None))
            .Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task Handle_BookingNotFound_ThrowsKeyNotFound()
    {
        _bookingRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Booking?)null);

        var command = new CancelBookingCommand(Guid.NewGuid(), _advertiserId, null);

        await _sut.Invoking(s => s.Handle(command, CancellationToken.None))
            .Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task Handle_CancelsBooking_SetsCorrectTimestamps()
    {
        var booking = CreateBooking();
        SetupValidBooking(booking);

        var command = new CancelBookingCommand(_bookingId, _advertiserId, "No longer needed");
        await _sut.Handle(command, CancellationToken.None);

        booking.CancelledAt.Should().NotBeNull();
        booking.CancelledAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        booking.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task Handle_CancelsBooking_UnlocksCreativeWhenNoOtherActiveBookings()
    {
        var booking = CreateBooking();
        var creative = new Creative { Id = booking.CreativeId, IsLocked = true, LockedReason = "Booked" };
        SetupValidBooking(booking);
        _creativeRepo.Setup(r => r.GetByIdAsync(booking.CreativeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(creative);

        var command = new CancelBookingCommand(_bookingId, _advertiserId, null);
        await _sut.Handle(command, CancellationToken.None);

        creative.IsLocked.Should().BeFalse();
        creative.LockedReason.Should().BeNull();
    }

    [Fact]
    public async Task Handle_NotificationFailure_DoesNotThrow()
    {
        var booking = CreateBooking();
        SetupValidBooking(booking);

        _notificationService.Setup(n => n.NotifyBookingCancelledAsync(
                It.IsAny<BookingDto>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string?>()))
            .ThrowsAsync(new Exception("Notification failed"));

        var command = new CancelBookingCommand(_bookingId, _advertiserId, "reason");

        // Should NOT throw — notification failures are swallowed
        var result = await _sut.Handle(command, CancellationToken.None);
        result.Should().NotBeNull();
    }
}
