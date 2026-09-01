using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using CCMS.Application.Interfaces;
using CCMS.Api.Extensions;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Payments;
using RazorpayUtils = Razorpay.Api.Utils;
using System.Security.Claims;
using System.Text.Json;

using Payment = CCMS.Domain.Entities.Payment;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

[Authorize]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[EnableRateLimiting(RateLimitingExtensions.ApiPolicy)]
public class PaymentsController : ControllerBase
{
    private readonly IRazorpayService _razorpayService;
    private readonly IRepository<Payment> _paymentRepository;
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Payout> _payoutRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IConfiguration _configuration;
    private readonly INotificationService _notificationService;
    private readonly ILogger<PaymentsController> _logger;

    public PaymentsController(
        IRazorpayService razorpayService,
        IRepository<Payment> paymentRepository,
        IRepository<Booking> bookingRepository,
        IRepository<Screen> screenRepository,
        IRepository<Payout> payoutRepository,
        IUnitOfWork unitOfWork,
        IConfiguration configuration,
        INotificationService notificationService,
        ILogger<PaymentsController> logger)
    {
        _razorpayService = razorpayService;
        _paymentRepository = paymentRepository;
        _bookingRepository = bookingRepository;
        _screenRepository = screenRepository;
        _payoutRepository = payoutRepository;
        _unitOfWork = unitOfWork;
        _configuration = configuration;
        _notificationService = notificationService;
        _logger = logger;
    }

    /// <summary>
    /// Create a Razorpay order for a booking payment
    /// </summary>
    [HttpPost("create-order")]
    public async Task<ActionResult<ApiResponse<CreateOrderResponse>>> CreateOrder([FromBody] CreateOrderRequest request)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var booking = await _bookingRepository.GetByIdAsync(request.BookingId);
        if (booking == null)
            return NotFound(ApiResponse<CreateOrderResponse>.ErrorResponse("Booking not found"));

        if (booking.PaymentStatus == PaymentStatus.Captured)
            return BadRequest(ApiResponse<CreateOrderResponse>.ErrorResponse("Booking is already paid"));

        if (booking.Status != BookingStatus.Approved)
            return BadRequest(ApiResponse<CreateOrderResponse>.ErrorResponse("Booking must be approved before payment"));

        // Date guard: reject payment if booking start date has already passed
        if (DateOnly.FromDateTime(DateTime.Today) > booking.StartDate)
            return BadRequest(ApiResponse<CreateOrderResponse>.ErrorResponse(
                "Cannot pay for a booking whose start date has already passed. Please update the booking dates and try again."));

        // Check if payment has expired
        if (booking.PaymentExpiresAt.HasValue && DateTime.UtcNow > booking.PaymentExpiresAt.Value)
            return BadRequest(ApiResponse<CreateOrderResponse>.ErrorResponse(
                "Payment window has expired. The booking will be cancelled automatically."));

        // If booking already has a Razorpay order (created during approval), return it
        if (!string.IsNullOrEmpty(booking.RazorpayOrderId) && booking.PaymentStatus == PaymentStatus.OrderCreated)
        {
            return Ok(ApiResponse<CreateOrderResponse>.SuccessResponse(new CreateOrderResponse
            {
                OrderId = booking.RazorpayOrderId,
                Amount = booking.TotalPrice,
                Currency = booking.Currency,
                KeyId = _configuration["Razorpay:KeyId"]!,
                BookingId = booking.Id,
                VirtualAccountNumber = booking.VirtualAccountNumber,
                VirtualAccountIfsc = booking.VirtualAccountIfsc,
                PaymentExpiresAt = booking.PaymentExpiresAt
            }));
        }

        // Fallback: create a new order if one doesn't exist
        var receipt = $"booking_{booking.Id:N}";
        var order = await _razorpayService.CreateOrderAsync(booking.TotalPrice, booking.Currency, receipt);

        booking.RazorpayOrderId = order.OrderId;
        booking.PaymentStatus = PaymentStatus.OrderCreated;
        booking.PaymentExpiresAt = DateTime.UtcNow.AddHours(24);
        await _bookingRepository.UpdateAsync(booking);

        // Create Payment record for tracking
        var payment = new Payment
        {
            BookingId = booking.Id,
            UserId = userId,
            RazorpayOrderId = order.OrderId,
            Amount = booking.TotalPrice,
            Currency = booking.Currency,
            Status = PaymentStatus.OrderCreated
        };

        await _paymentRepository.AddAsync(payment);
        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Payment order created: {OrderId} for booking {BookingId}", order.OrderId, booking.Id);

        return Ok(ApiResponse<CreateOrderResponse>.SuccessResponse(new CreateOrderResponse
        {
            OrderId = order.OrderId,
            Amount = booking.TotalPrice,
            Currency = booking.Currency,
            KeyId = _configuration["Razorpay:KeyId"]!,
            BookingId = booking.Id,
            PaymentExpiresAt = booking.PaymentExpiresAt
        }));
    }

    /// <summary>
    /// Verify payment after Razorpay checkout completes
    /// </summary>
    [HttpPost("verify")]
    public async Task<ActionResult<ApiResponse<PaymentDto>>> VerifyPayment([FromBody] VerifyPaymentRequest request)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        // Find the payment by Razorpay order ID
        var payments = await _paymentRepository.FindAsync(p => p.RazorpayOrderId == request.RazorpayOrderId);
        var payment = payments.FirstOrDefault();

        if (payment == null)
            return NotFound(ApiResponse<PaymentDto>.ErrorResponse("Payment order not found"));

        if (payment.UserId != userId)
            return Forbid();

        if (payment.Status == PaymentStatus.Captured)
            return Ok(ApiResponse<PaymentDto>.SuccessResponse(MapToDto(payment), "Payment already verified"));

        // Verify signature
        var isValid = _razorpayService.VerifyPaymentSignature(
            request.RazorpayOrderId, request.RazorpayPaymentId, request.RazorpaySignature);

        if (!isValid)
        {
            payment.Status = PaymentStatus.Expired;
            payment.GatewayResponse = JsonSerializer.Serialize(new { error = "Signature verification failed" });
            await _paymentRepository.UpdateAsync(payment);
            await _unitOfWork.SaveChangesAsync();

            return BadRequest(ApiResponse<PaymentDto>.ErrorResponse("Payment verification failed"));
        }

        // Update payment
        payment.RazorpayPaymentId = request.RazorpayPaymentId;
        payment.RazorpaySignature = request.RazorpaySignature;
        payment.Status = PaymentStatus.Captured;
        await _paymentRepository.UpdateAsync(payment);

        // Update booking payment status
        var booking = await _bookingRepository.GetByIdAsync(payment.BookingId);
        if (booking != null)
        {
            // Date guard: reject payment verification if booking start date has already passed
            if (DateOnly.FromDateTime(DateTime.Today) > booking.StartDate)
            {
                payment.Status = PaymentStatus.Expired;
                payment.GatewayResponse = JsonSerializer.Serialize(new { error = "Booking start date has passed" });
                await _paymentRepository.UpdateAsync(payment);
                await _unitOfWork.SaveChangesAsync();
                return BadRequest(ApiResponse<PaymentDto>.ErrorResponse(
                    "Cannot complete payment for a booking whose start date has already passed."));
            }

            booking.PaymentStatus = PaymentStatus.Captured;
            booking.RazorpayPaymentId = request.RazorpayPaymentId;
            booking.UpdatedAt = DateTime.UtcNow;
            await _bookingRepository.UpdateAsync(booking);
        }

        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Payment verified: {PaymentId} for booking {BookingId}",
            request.RazorpayPaymentId, payment.BookingId);

        // Notify the advertiser that payment was captured
        await _notificationService.CreateNotificationAsync(
            payment.UserId,
            "Payment Successful",
            $"Your payment of {payment.Currency} {payment.Amount:N2} for booking has been captured.",
            NotificationType.PaymentReceived,
            $"/bookings/{payment.BookingId}",
            payment.BookingId,
            "Payment");

        // Notify screen owner about the payment
        if (booking != null)
        {
            var screen = await _screenRepository.GetByIdAsync(booking.ScreenId);
            if (screen != null)
            {
                await _notificationService.CreateNotificationAsync(
                    screen.OwnerId,
                    "Payment Received",
                    $"Payment of {payment.Currency} {payment.Amount:N2} received for a booking on {screen.Name}.",
                    NotificationType.PaymentReceived,
                    $"/bookings/{payment.BookingId}",
                    payment.BookingId,
                    "Payment");

                // Auto-create advance payout for screen owner
                if (booking.Status == BookingStatus.Approved)
                {
                    await CreateAdvancePayoutAsync(booking, screen);
                }
            }
        }

        return Ok(ApiResponse<PaymentDto>.SuccessResponse(MapToDto(payment), "Payment verified successfully"));
    }

    /// <summary>
    /// Razorpay webhook endpoint (no auth — verified via webhook signature).
    /// Rate-limiting is disabled here because Razorpay retries failed deliveries from
    /// a small pool of source IPs; the HMAC signature check is the real gate.
    /// </summary>
    [AllowAnonymous]
    [DisableRateLimiting]
    [HttpPost("webhook")]
    public async Task<IActionResult> Webhook()
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();

        var webhookSecret = _configuration["Razorpay:WebhookSecret"];
        var signature = Request.Headers["X-Razorpay-Signature"].FirstOrDefault();

        if (string.IsNullOrEmpty(signature) || string.IsNullOrEmpty(webhookSecret))
        {
            _logger.LogWarning("Webhook received without signature or secret not configured");
            return BadRequest();
        }

        // Verify webhook signature
        try
        {
            RazorpayUtils.verifyWebhookSignature(body, signature, webhookSecret);
        }
        catch
        {
            _logger.LogWarning("Webhook signature verification failed");
            return BadRequest();
        }

        var payload = JsonSerializer.Deserialize<JsonElement>(body);
        var eventType = payload.GetProperty("event").GetString();

        _logger.LogInformation("Razorpay webhook received: {EventType}", eventType);

        switch (eventType)
        {
            case "payment.captured":
                await HandlePaymentCaptured(payload);
                break;
            case "payment.failed":
                await HandlePaymentFailed(payload);
                break;
            case "refund.processed":
                await HandleRefundProcessed(payload);
                break;
        }

        return Ok();
    }

    /// <summary>
    /// Get payment details for a booking
    /// </summary>
    [HttpGet("booking/{bookingId:guid}")]
    public async Task<ActionResult<ApiResponse<List<PaymentDto>>>> GetByBooking(Guid bookingId)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var payments = await _paymentRepository.FindAsync(p => p.BookingId == bookingId);
        var paymentList = payments.ToList();

        if (paymentList.Count > 0 && paymentList[0].UserId != userId)
        {
            // Check if requesting user is the screen owner
            var booking = await _bookingRepository.GetByIdAsync(bookingId);
            if (booking != null)
            {
                var screen = await _screenRepository.GetByIdAsync(booking.ScreenId);
                var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
                if (screen?.OwnerId != userId && userRole != "Admin")
                    return Forbid();
            }
        }

        return Ok(ApiResponse<List<PaymentDto>>.SuccessResponse(paymentList.Select(MapToDto).ToList()));
    }

    /// <summary>
    /// Get payment status for a booking (lightweight polling endpoint)
    /// </summary>
    [HttpGet("booking/{bookingId:guid}/status")]
    public async Task<ActionResult<ApiResponse<BookingPaymentStatusDto>>> GetPaymentStatus(Guid bookingId)
    {
        var booking = await _bookingRepository.GetByIdAsync(bookingId);
        if (booking == null)
            return NotFound(ApiResponse<BookingPaymentStatusDto>.ErrorResponse("Booking not found"));

        // Resource ownership: only the advertiser who paid (any Payment row owner), the screen
        // owner, or an admin may read its payment status. Return 404 (not 403) when the caller is
        // unrelated so we don't leak existence of bookings to scanners.
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        if (role != "Admin")
        {
            var payments = await _paymentRepository.FindAsync(p => p.BookingId == bookingId);
            var isAdvertiser = payments.Any(p => p.UserId == userId);
            var isOwner = false;
            if (!isAdvertiser)
            {
                var screen = await _screenRepository.GetByIdAsync(booking.ScreenId);
                isOwner = screen != null && screen.OwnerId == userId;
            }
            if (!isAdvertiser && !isOwner)
                return NotFound(ApiResponse<BookingPaymentStatusDto>.ErrorResponse("Booking not found"));
        }

        return Ok(ApiResponse<BookingPaymentStatusDto>.SuccessResponse(new BookingPaymentStatusDto
        {
            BookingId = booking.Id,
            PaymentStatus = booking.PaymentStatus.ToString(),
            PaymentMethod = booking.PaymentMethod,
            PaymentExpiresAt = booking.PaymentExpiresAt,
            RazorpayOrderId = booking.RazorpayOrderId
        }));
    }

    /// <summary>
    /// Initiate a refund (Admin only)
    /// </summary>
    [HttpPost("refund")]
    public async Task<ActionResult<ApiResponse<PaymentDto>>> Refund([FromBody] RefundRequest request)
    {
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
        if (userRole != "Admin")
            return Forbid();

        var payment = await _paymentRepository.GetByIdAsync(request.PaymentId);
        if (payment == null)
            return NotFound(ApiResponse<PaymentDto>.ErrorResponse("Payment not found"));

        if (payment.Status != PaymentStatus.Captured)
            return BadRequest(ApiResponse<PaymentDto>.ErrorResponse("Payment is not in a refundable state"));

        if (string.IsNullOrEmpty(payment.RazorpayPaymentId))
            return BadRequest(ApiResponse<PaymentDto>.ErrorResponse("No Razorpay payment ID found"));

        var refundAmount = request.Amount ?? payment.Amount;
        var result = await _razorpayService.InitiateRefundAsync(payment.RazorpayPaymentId, refundAmount);

        payment.Status = PaymentStatus.Refunded;
        payment.RefundedAt = DateTime.UtcNow;
        payment.RefundAmount = refundAmount;
        payment.GatewayResponse = JsonSerializer.Serialize(new { refundId = result.RefundId, reason = request.Reason });
        await _paymentRepository.UpdateAsync(payment);

        // Update booking payment status
        var booking = await _bookingRepository.GetByIdAsync(payment.BookingId);
        if (booking != null)
        {
            booking.PaymentStatus = PaymentStatus.RefundInitiated;
            booking.RazorpayRefundId = result.RefundId;
            booking.UpdatedAt = DateTime.UtcNow;
            await _bookingRepository.UpdateAsync(booking);
        }

        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Refund processed: {RefundId} for payment {PaymentId}, amount {Amount}",
            result.RefundId, payment.Id, refundAmount);

        // Notify the user about the refund
        await _notificationService.CreateNotificationAsync(
            payment.UserId,
            "Refund Processed",
            $"A refund of {payment.Currency} {refundAmount:N2} has been initiated for your payment.",
            NotificationType.RefundProcessed,
            $"/bookings/{payment.BookingId}",
            payment.BookingId,
            "Payment");

        return Ok(ApiResponse<PaymentDto>.SuccessResponse(MapToDto(payment), "Refund initiated successfully"));
    }

    private async Task HandlePaymentCaptured(JsonElement payload)
    {
        var paymentEntity = payload.GetProperty("payload").GetProperty("payment").GetProperty("entity");
        var razorpayPaymentId = paymentEntity.GetProperty("id").GetString();
        var orderId = paymentEntity.GetProperty("order_id").GetString();
        var method = paymentEntity.TryGetProperty("method", out var methodProp) ? methodProp.GetString() : null;

        if (string.IsNullOrEmpty(orderId)) return;

        try
        {
            // Execution-strategy-safe transaction: begin→work→commit runs as one
            // retriable unit, and each retry attempt re-reads fresh state.
            await _unitOfWork.ExecuteInTransactionAsync(async _ =>
            {
                var payments = await _paymentRepository.FindAsync(p => p.RazorpayOrderId == orderId);
                var payment = payments.FirstOrDefault();
                if (payment != null && payment.Status == PaymentStatus.Captured)
                {
                    // Replay: webhook delivered twice for the same captured payment. Acknowledge silently.
                    _logger.LogInformation("Webhook replay ignored: payment {OrderId} already captured", orderId);
                    return;
                }

                if (payment != null)
                {
                    payment.RazorpayPaymentId = razorpayPaymentId;
                    payment.Status = PaymentStatus.Captured;
                    payment.GatewayResponse = paymentEntity.GetRawText();
                    await _paymentRepository.UpdateAsync(payment);
                }

                var bookings = await _bookingRepository.FindAsync(b => b.RazorpayOrderId == orderId);
                var booking = bookings.FirstOrDefault();
                if (booking != null && booking.PaymentStatus != PaymentStatus.Captured)
                {
                    booking.RazorpayPaymentId = razorpayPaymentId;
                    booking.PaymentStatus = PaymentStatus.Captured;
                    booking.PaymentMethod = method?.ToUpperInvariant() == "BANK_TRANSFER" ? "BankTransfer" : "UPI";
                    booking.UpdatedAt = DateTime.UtcNow;
                    await _bookingRepository.UpdateAsync(booking);
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Webhook HandlePaymentCaptured FAILED for order {OrderId}", orderId);
            throw; // Re-throw so Razorpay sees non-2xx and retries.
        }
    }

    private async Task HandlePaymentFailed(JsonElement payload)
    {
        var paymentEntity = payload.GetProperty("payload").GetProperty("payment").GetProperty("entity");
        var orderId = paymentEntity.GetProperty("order_id").GetString();

        if (string.IsNullOrEmpty(orderId)) return;

        try
        {
            await _unitOfWork.ExecuteInTransactionAsync(async _ =>
            {
                var payments = await _paymentRepository.FindAsync(p => p.RazorpayOrderId == orderId);
                var payment = payments.FirstOrDefault();
                if (payment != null)
                {
                    payment.Status = PaymentStatus.Expired;
                    payment.GatewayResponse = paymentEntity.GetRawText();
                    await _paymentRepository.UpdateAsync(payment);
                }

                var bookings = await _bookingRepository.FindAsync(b => b.RazorpayOrderId == orderId);
                var booking = bookings.FirstOrDefault();
                if (booking != null && booking.PaymentStatus == PaymentStatus.OrderCreated)
                {
                    booking.PaymentStatus = PaymentStatus.Expired;
                    booking.UpdatedAt = DateTime.UtcNow;
                    await _bookingRepository.UpdateAsync(booking);
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Webhook HandlePaymentFailed FAILED for order {OrderId}", orderId);
            throw;
        }
    }

    private async Task HandleRefundProcessed(JsonElement payload)
    {
        var refundEntity = payload.GetProperty("payload").GetProperty("refund").GetProperty("entity");
        var razorpayPaymentId = refundEntity.GetProperty("payment_id").GetString();
        var refundId = refundEntity.GetProperty("id").GetString();

        if (string.IsNullOrEmpty(razorpayPaymentId)) return;

        try
        {
            await _unitOfWork.ExecuteInTransactionAsync(async _ =>
            {
                var payments = await _paymentRepository.FindAsync(p => p.RazorpayPaymentId == razorpayPaymentId);
                var payment = payments.FirstOrDefault();
                if (payment != null && payment.Status == PaymentStatus.Refunded)
                {
                    _logger.LogInformation("Webhook replay ignored: payment {PaymentId} already refunded", razorpayPaymentId);
                    return;
                }

                if (payment != null)
                {
                    payment.Status = PaymentStatus.Refunded;
                    payment.RefundedAt = DateTime.UtcNow;
                    payment.RefundAmount = refundEntity.GetProperty("amount").GetDecimal() / 100m;
                    payment.GatewayResponse = refundEntity.GetRawText();
                    await _paymentRepository.UpdateAsync(payment);
                }

                var bookings = await _bookingRepository.FindAsync(b => b.RazorpayPaymentId == razorpayPaymentId);
                var booking = bookings.FirstOrDefault();
                if (booking != null && booking.PaymentStatus != PaymentStatus.Refunded)
                {
                    booking.PaymentStatus = PaymentStatus.Refunded;
                    booking.RazorpayRefundId = refundId;
                    booking.UpdatedAt = DateTime.UtcNow;
                    await _bookingRepository.UpdateAsync(booking);
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Webhook HandleRefundProcessed FAILED for payment {PaymentId}", razorpayPaymentId);
            throw;
        }
    }

    private static PaymentDto MapToDto(Payment p) => new()
    {
        Id = p.Id,
        BookingId = p.BookingId,
        UserId = p.UserId,
        RazorpayOrderId = p.RazorpayOrderId,
        RazorpayPaymentId = p.RazorpayPaymentId,
        Amount = p.Amount,
        Currency = p.Currency,
        Status = p.Status.ToString(),
        CreatedAt = p.CreatedAt,
        RefundedAt = p.RefundedAt,
        RefundAmount = p.RefundAmount
    };

    /// <summary>
    /// Auto-create advance payout for screen owner when payment is captured.
    /// Uses DefaultAdvancePercentage from configuration.
    /// </summary>
    private async Task CreateAdvancePayoutAsync(Booking booking, Screen screen)
    {
        try
        {
            // Check if advance payout already exists for this booking
            var existingPayouts = await _payoutRepository.FindAsync(p =>
                p.BookingId == booking.Id && p.Type == PayoutType.Advance);
            if (existingPayouts.Any())
                return;

            var advancePercentage = _configuration.GetValue<decimal>("Platform:DefaultAdvancePercentage", 50);
            var commissionPercentage = _configuration.GetValue<decimal>("Platform:CommissionPercentage", 10);

            var grossAmount = booking.TotalPrice * (advancePercentage / 100m);
            var commissionAmount = grossAmount * (commissionPercentage / 100m);
            var netAmount = grossAmount - commissionAmount;

            var payout = new Payout
            {
                ScreenOwnerId = screen.OwnerId,
                BookingId = booking.Id,
                Type = PayoutType.Advance,
                AdvancePercentage = advancePercentage,
                GrossAmount = grossAmount,
                CommissionPercentage = commissionPercentage,
                CommissionAmount = commissionAmount,
                NetAmount = netAmount,
                Currency = booking.Currency,
                Status = PayoutStatus.Pending,
                PeriodStart = booking.StartDate,
                PeriodEnd = booking.EndDate,
                CreatedAt = DateTime.UtcNow
            };

            await _payoutRepository.AddAsync(payout);
            await _unitOfWork.SaveChangesAsync();

            _logger.LogInformation(
                "Advance payout created: {PayoutId} for booking {BookingId}, net amount {Currency} {NetAmount:N2}",
                payout.Id, booking.Id, payout.Currency, netAmount);

            // Notify admins about pending advance payout
            await _notificationService.CreateAdminNotificationsAsync(
                "Advance Payout Pending",
                $"Advance payout of {payout.Currency} {netAmount:N2} pending for booking on {screen.Name}.",
                NotificationType.PayoutAdvanceProcessed,
                $"/admin/payouts/{payout.Id}",
                payout.Id,
                "Payout");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create advance payout for booking {BookingId}", booking.Id);
            // Don't throw — payment verification should still succeed
        }
    }
}
