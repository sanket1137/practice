using AutoMapper;
using CCMS.Application.Interfaces;
using CCMS.Application.Services;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Bookings;
using MediatR;
using Microsoft.Extensions.Logging;
using System.Linq;

namespace CCMS.Application.Features.Bookings.Commands;

public class ApproveBookingCommandHandler : IRequestHandler<ApproveBookingCommand, BookingDto>
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
    private readonly ILogger<ApproveBookingCommandHandler> _logger;

    public ApproveBookingCommandHandler(
        IRepository<Booking> bookingRepository,
        IRepository<Screen> screenRepository,
        IRepository<Creative> creativeRepository,
        IRepository<Campaign> campaignRepository,
        SlotAvailabilityService slotAvailabilityService,
        IRazorpayService razorpayService,
        IUnitOfWork unitOfWork,
        IMapper mapper,
        IBookingNotificationService notificationService,
        ILogger<ApproveBookingCommandHandler> logger)
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

    public async Task<BookingDto> Handle(ApproveBookingCommand request, CancellationToken cancellationToken)
    {
        var booking = await _bookingRepository.GetByIdAsync(request.BookingId, cancellationToken);

        if (booking == null)
            throw new KeyNotFoundException("Booking not found");

        // Verify user owns the screen
        var screen = await _screenRepository.GetByIdAsync(booking.ScreenId, cancellationToken);
        if (screen == null || screen.OwnerId != request.UserId)
            throw new UnauthorizedAccessException("You can only approve bookings for your own screens");

        // Ensure we have stored daily assignments for this booking (partial or full)
        if (booking.DailySlotAssignments == null || !booking.DailySlotAssignments.Any())
        {
            throw new InvalidOperationException("Booking does not contain daily slot assignments; cannot approve.");
        }

        // Reserve each assigned slot for its specific date
        var updatedAssignments = new Dictionary<DateTime, int>();
        foreach (var kvp in booking.DailySlotAssignments)
        {
            var date = kvp.Key;
            var slotNumber = kvp.Value;
            try
            {
                // Try to book the originally assigned slot
                await _slotAvailabilityService.BookSlot(
                    booking.ScreenId,
                    slotNumber,
                    booking.Id,
                    date,
                    date,
                    cancellationToken);
                updatedAssignments[date] = slotNumber;
            }
            catch (InvalidOperationException)
            {
                // Slot no longer available – find another free slot for this date
                var availableSlots = await _slotAvailabilityService.GetDayAvailableSlots(
                    booking.ScreenId,
                    date,
                    cancellationToken);
                if (!availableSlots.Any())
                {
                    throw new InvalidOperationException($"No free slots available on {date:yyyy-MM-dd} during approval.");
                }
                var newSlot = availableSlots.First();
                await _slotAvailabilityService.BookSlot(
                    booking.ScreenId,
                    newSlot,
                    booking.Id,
                    date,
                    date,
                    cancellationToken);
                updatedAssignments[date] = newSlot;
            }
        }

        // Persist any reassigned slots
        booking.DailySlotAssignments = updatedAssignments;
        booking.SlotNumbers = updatedAssignments.Values.Distinct().ToList();

        // Update booking status after successful slot reservations
        booking.Status = Domain.Enums.BookingStatus.Approved;
        booking.ApprovedBy = request.UserId;
        booking.ApprovedAt = DateTime.UtcNow;
        booking.UpdatedAt = DateTime.UtcNow;

        // Lock the creative to prevent editing/deletion
        var creative = await _creativeRepository.GetByIdAsync(booking.CreativeId, cancellationToken);
        if (creative != null)
        {
            creative.IsLocked = true;
            creative.LockedReason = $"Used in approved booking {booking.Id}";
            creative.UpdatedAt = DateTime.UtcNow;
            await _creativeRepository.UpdateAsync(creative, cancellationToken);
        }

        // Skip payment for self-reserved bookings with internal payment
        if (booking.Source != Domain.Enums.BookingSource.SelfReserved || !booking.IsInternalPayment)
        {
            // Create Razorpay order for payment collection
            var receipt = $"booking_{booking.Id:N}";
            var order = await _razorpayService.CreateOrderAsync(booking.TotalPrice, booking.Currency, receipt);

            booking.RazorpayOrderId = order.OrderId;
            booking.PaymentStatus = PaymentStatus.OrderCreated;
            booking.PaymentExpiresAt = DateTime.UtcNow.AddHours(24);

            _logger.LogInformation(
                "Razorpay order {OrderId} created for booking {BookingId}, expires at {ExpiresAt}",
                order.OrderId, booking.Id, booking.PaymentExpiresAt);

            // Create virtual account for bank transfer option
            try
            {
                var va = await _razorpayService.CreateVirtualAccountAsync(
                    order.OrderId, $"Payment for booking on {screen.Name}");
                booking.VirtualAccountNumber = va.AccountNumber;
                booking.VirtualAccountIfsc = va.Ifsc;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to create virtual account for booking {BookingId}, bank transfer will be unavailable", booking.Id);
            }
        }

        await _bookingRepository.UpdateAsync(booking, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var bookingDto = _mapper.Map<BookingDto>(booking);

        // Notify advertiser that their booking has been approved
        try
        {
            var campaign = booking.CampaignId.HasValue ? await _campaignRepository.GetByIdAsync(booking.CampaignId.Value, cancellationToken) : null;
            if (campaign != null)
            {
                await _notificationService.NotifyBookingApprovedAsync(bookingDto, campaign.AdvertiserId);
            }
        }
        catch (Exception)
        {
            // Don't fail the approval if notification fails
        }

        return bookingDto;
    }
}
