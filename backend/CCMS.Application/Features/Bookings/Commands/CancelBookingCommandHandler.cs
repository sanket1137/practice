using AutoMapper;
using CCMS.Application.Interfaces;
using CCMS.Application.Services;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Helpers;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Bookings;
using MediatR;
using Microsoft.Extensions.Logging;

namespace CCMS.Application.Features.Bookings.Commands;

public class CancelBookingCommandHandler : IRequestHandler<CancelBookingCommand, BookingDto>
{
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Creative> _creativeRepository;
    private readonly IRepository<Campaign> _campaignRepository;
    private readonly SlotAvailabilityService _slotAvailabilityService;
    private readonly IRazorpayService _razorpayService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly IBookingNotificationService _notificationService;
    private readonly ILogger<CancelBookingCommandHandler> _logger;

    public CancelBookingCommandHandler(
        IRepository<Booking> bookingRepository,
        IRepository<Screen> screenRepository,
        IRepository<Creative> creativeRepository,
        IRepository<Campaign> campaignRepository,
        SlotAvailabilityService slotAvailabilityService,
        IRazorpayService razorpayService,
        IUnitOfWork unitOfWork,
        IMapper mapper,
        IBookingNotificationService notificationService,
        ILogger<CancelBookingCommandHandler> logger)
    {
        _bookingRepository = bookingRepository;
        _screenRepository = screenRepository;
        _creativeRepository = creativeRepository;
        _campaignRepository = campaignRepository;
        _slotAvailabilityService = slotAvailabilityService;
        _razorpayService = razorpayService;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task<BookingDto> Handle(CancelBookingCommand request, CancellationToken cancellationToken)
    {
        var booking = await _bookingRepository.GetByIdAsync(request.BookingId, cancellationToken);
        if (booking == null)
            throw new KeyNotFoundException("Booking not found");

        // Verify user is the advertiser (campaign owner), screen owner, or admin
        var campaign = booking.CampaignId.HasValue ? await _campaignRepository.GetByIdAsync(booking.CampaignId.Value, cancellationToken) : null;
        var screen = await _screenRepository.GetByIdAsync(booking.ScreenId, cancellationToken);

        if (campaign == null || screen == null)
            throw new KeyNotFoundException("Related campaign or screen not found");

        bool isAdvertiser = campaign.AdvertiserId == request.UserId;
        bool isScreenOwner = screen.OwnerId == request.UserId;

        if (!isAdvertiser && !isScreenOwner)
            throw new UnauthorizedAccessException("You can only cancel your own bookings or bookings on your screens");

        // Check if booking can be cancelled
        if (!booking.Status.CanCancel())
            throw new InvalidOperationException($"Booking in '{booking.Status.GetDisplayName()}' status cannot be cancelled");

        // Update booking status
        booking.Status = Domain.Enums.BookingStatus.Cancelled;
        booking.CancelledBy = request.UserId;
        booking.CancelledAt = DateTime.UtcNow;
        booking.CancellationReason = request.CancellationReason;
        booking.UpdatedAt = DateTime.UtcNow;

        // Release all booked slots
        await _slotAvailabilityService.UnbookSlot(booking.Id, cancellationToken);

        // Initiate refund if payment was captured
        if (booking.PaymentStatus == PaymentStatus.Captured && !string.IsNullOrEmpty(booking.RazorpayPaymentId))
        {
            try
            {
                var refundResult = await _razorpayService.InitiateRefundAsync(booking.RazorpayPaymentId, booking.TotalPrice);
                booking.RazorpayRefundId = refundResult.RefundId;
                booking.PaymentStatus = PaymentStatus.RefundInitiated;

                _logger.LogInformation(
                    "Refund {RefundId} initiated for booking {BookingId}, amount {Amount} {Currency}",
                    refundResult.RefundId, booking.Id, booking.TotalPrice, booking.Currency);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to initiate refund for booking {BookingId}", booking.Id);
            }
        }
        else if (booking.PaymentStatus == PaymentStatus.OrderCreated)
        {
            // No payment was made, just expire the order
            booking.PaymentStatus = PaymentStatus.Expired;
        }

        // Unlock the creative if it was locked for this booking
        var creative = await _creativeRepository.GetByIdAsync(booking.CreativeId, cancellationToken);
        if (creative != null && creative.IsLocked)
        {
            // Only unlock if no other active bookings use this creative
            var allBookings = await _bookingRepository.FindAsync(
                b => b.CreativeId == creative.Id && b.Id != booking.Id && 
                     (b.Status == Domain.Enums.BookingStatus.Approved || b.Status == Domain.Enums.BookingStatus.Active),
                cancellationToken);

            if (!allBookings.Any())
            {
                creative.IsLocked = false;
                creative.LockedReason = null;
                creative.UpdatedAt = DateTime.UtcNow;
                await _creativeRepository.UpdateAsync(creative, cancellationToken);
            }
        }

        await _bookingRepository.UpdateAsync(booking, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var bookingDto = _mapper.Map<BookingDto>(booking);

        // Notify both parties
        try
        {
            await _notificationService.NotifyBookingCancelledAsync(
                bookingDto, screen.OwnerId, campaign.AdvertiserId, request.CancellationReason);
        }
        catch (Exception)
        {
            // Don't fail the cancellation if notification fails
        }

        return bookingDto;
    }
}
