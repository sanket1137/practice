using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CCMS.Application.Services;

/// <summary>
/// Core service for updating booking statuses based on dates and operating schedules.
/// This service can be used by both background services and serverless functions.
///
/// It is also where the payout promises become real: the moment a booking
/// transitions to Active, the owner's advance payout record is created — not
/// when payment is captured (that trigger sat in a dormant payment path and
/// never fired while online payments are disabled). When the booking
/// completes, the delivery-linked final payout is computed from actual
/// impressions vs expected.
/// </summary>
public class BookingStatusUpdateService
{
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Payout> _payoutRepository;
    private readonly IRepository<Impression> _impressionRepository;
    private readonly IRepository<Campaign> _campaignRepository;
    private readonly IRepository<Notification> _notificationRepository;
    private readonly INotificationService _notificationService;
    private readonly IConfiguration _configuration;
    private readonly IRazorpayService _razorpayService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<BookingStatusUpdateService> _logger;

    public BookingStatusUpdateService(
        IRepository<Booking> bookingRepository,
        IRepository<Screen> screenRepository,
        IRepository<Payout> payoutRepository,
        IRepository<Impression> impressionRepository,
        IRepository<Campaign> campaignRepository,
        IRepository<Notification> notificationRepository,
        INotificationService notificationService,
        IConfiguration configuration,
        IRazorpayService razorpayService,
        IUnitOfWork unitOfWork,
        ILogger<BookingStatusUpdateService> logger)
    {
        _bookingRepository = bookingRepository;
        _screenRepository = screenRepository;
        _payoutRepository = payoutRepository;
        _impressionRepository = impressionRepository;
        _campaignRepository = campaignRepository;
        _notificationRepository = notificationRepository;
        _notificationService = notificationService;
        _configuration = configuration;
        _razorpayService = razorpayService;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    /// <summary>
    /// Updates all booking statuses based on current date/time and screen operating schedules.
    /// Returns the number of bookings that were updated.
    /// </summary>
    public async Task<int> UpdateBookingStatusesAsync(CancellationToken cancellationToken = default)
    {
        // Use local time since booking dates are stored in local time
        var now = DateTime.Now;
        var today = now.Date;
        var updatedCount = 0;

        _logger.LogInformation("Starting booking status update check at {Time} (Local Time)", now);

        try
        {
            // Get all bookings that might need status updates
            var bookingsToCheck = await _bookingRepository.GetAllAsync(cancellationToken);
            var todayDate = DateOnly.FromDateTime(now);
            
            // Filter to Pending, Approved, and Active bookings
            var relevantBookings = bookingsToCheck
                .Where(b => b.Status == BookingStatus.Pending || 
                            b.Status == BookingStatus.Approved || 
                            b.Status == BookingStatus.Active)
                .ToList();

            _logger.LogInformation("Found {Count} bookings to check for status updates", relevantBookings.Count);

            foreach (var booking in relevantBookings)
            {
                try
                {
                    var oldStatus = booking.Status;

                    // Pending bookings run through the approval SLA: a reminder to
                    // the owner while the request is still actionable, expiry when
                    // it has rotted past the SLA or its whole window has passed.
                    if (booking.Status == BookingStatus.Pending)
                    {
                        if (await ApplyApprovalSlaAsync(booking, todayDate, now, cancellationToken))
                        {
                            updatedCount++;
                        }
                        continue;
                    }

                    // For Approved/Active bookings, determine status based on schedule
                    var screen = await _screenRepository.GetByIdAsync(booking.ScreenId, cancellationToken);
                    if (screen == null)
                    {
                        _logger.LogWarning("Screen {ScreenId} not found for booking {BookingId}", 
                            booking.ScreenId, booking.Id);
                        continue;
                    }

                    var newStatus = DetermineBookingStatus(booking, screen, now);

                    if (oldStatus != newStatus)
                    {
                        booking.Status = newStatus;
                        booking.UpdatedAt = now;

                        await _bookingRepository.UpdateAsync(booking, cancellationToken);
                        updatedCount++;

                        _logger.LogInformation(
                            "Booking {BookingId} status updated: {OldStatus} → {NewStatus} " +
                            "(Campaign: {CampaignId}, Screen: {ScreenName})",
                            booking.Id, oldStatus, newStatus, booking.CampaignId, screen.Name);

                        // The on-air moment: the CampaignLive notification finally
                        // has a real trigger — the first play-eligible transition.
                        if (newStatus == BookingStatus.Active && booking.CampaignId.HasValue)
                        {
                            var liveCampaign = await _campaignRepository.GetByIdAsync(booking.CampaignId.Value, cancellationToken);
                            if (liveCampaign != null)
                            {
                                await SafeNotifyAsync(liveCampaign.AdvertiserId,
                                    "Your campaign is live",
                                    $"'{liveCampaign.Name}' is now playing on '{screen.Name}'. Watch it in the Command Center.",
                                    NotificationType.CampaignLive,
                                    $"/campaigns/{liveCampaign.Id}");
                                await _notificationService.BroadcastCampaignEventAsync(liveCampaign.Id,
                                    "CampaignStatusChanged",
                                    new { campaignId = liveCampaign.Id.ToString(), status = "Active", subState = "live" });
                            }
                        }
                    }

                    // Payout moments — idempotent and best-effort, so a payout
                    // hiccup never blocks the status sweep. Checked on every
                    // sweep for the booking's CURRENT state (not only on the
                    // transition), so bookings that were already Active/Completed
                    // when this engine shipped — or whose creation failed once —
                    // self-heal on the next pass.
                    if (booking.Status == BookingStatus.Active)
                    {
                        await TryCreateAdvancePayoutAsync(booking, screen, cancellationToken);
                    }
                    else if (booking.Status == BookingStatus.Completed)
                    {
                        // No retroactive advance here: if none was ever created the
                        // final becomes a Full-type payout covering everything.
                        await TryCreateFinalPayoutAsync(booking, screen, cancellationToken);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error updating booking {BookingId}", booking.Id);
                }
            }

            // --- Payment expiry check ---
            // Cancel bookings where payment window has expired (OrderCreated + PaymentExpiresAt passed)
            var expiredPaymentBookings = bookingsToCheck
                .Where(b => b.PaymentStatus == PaymentStatus.OrderCreated
                         && b.PaymentExpiresAt.HasValue
                         && DateTime.UtcNow > b.PaymentExpiresAt.Value)
                .ToList();

            foreach (var booking in expiredPaymentBookings)
            {
                try
                {
                    booking.Status = BookingStatus.Cancelled;
                    booking.PaymentStatus = PaymentStatus.Expired;
                    booking.CancellationReason = "Auto-cancelled: payment window expired";
                    booking.CancelledAt = now;
                    booking.UpdatedAt = now;

                    await _bookingRepository.UpdateAsync(booking, cancellationToken);
                    updatedCount++;

                    _logger.LogInformation(
                        "Booking {BookingId} auto-cancelled: payment expired at {ExpiresAt}",
                        booking.Id, booking.PaymentExpiresAt);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error expiring payment for booking {BookingId}", booking.Id);
                }
            }

            // --- Refund status polling ---
            // Check refund status for bookings with RefundInitiated > 1 hour ago
            var refundBookings = bookingsToCheck
                .Where(b => b.PaymentStatus == PaymentStatus.RefundInitiated
                         && !string.IsNullOrEmpty(b.RazorpayRefundId)
                         && !string.IsNullOrEmpty(b.RazorpayPaymentId)
                         && b.CancelledAt.HasValue
                         && DateTime.UtcNow > b.CancelledAt.Value.AddHours(1))
                .ToList();

            foreach (var booking in refundBookings)
            {
                try
                {
                    var refundStatus = await _razorpayService.GetRefundStatusAsync(
                        booking.RazorpayPaymentId!, booking.RazorpayRefundId!);

                    if (refundStatus.Status == "processed")
                    {
                        booking.PaymentStatus = PaymentStatus.Refunded;
                        booking.UpdatedAt = now;
                        await _bookingRepository.UpdateAsync(booking, cancellationToken);
                        updatedCount++;

                        _logger.LogInformation(
                            "Booking {BookingId} refund confirmed: {RefundId} status={Status}",
                            booking.Id, booking.RazorpayRefundId, refundStatus.Status);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error checking refund status for booking {BookingId}", booking.Id);
                }
            }

            if (updatedCount > 0)
            {
                await _unitOfWork.SaveChangesAsync(cancellationToken);
                _logger.LogInformation("Successfully updated {Count} booking(s)", updatedCount);
            }
            else
            {
                _logger.LogInformation("No bookings required status updates");
            }

            // Campaign state is a pure function of the campaign's bookings —
            // derived here, after booking transitions, by the only writer.
            // (Before this existed, CampaignStatus was set to Draft at creation
            // and never touched again: every campaign read "Draft" forever.)
            await UpdateCampaignStatusesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during booking status update process");
            throw;
        }

        return updatedCount;
    }

    // ── Campaign lifecycle: derived, single-writer ──────────────────────────

    private static CampaignStatus DeriveCampaignStatus(CampaignStatus current, List<Booking>? bookings)
    {
        if (bookings == null || bookings.Count == 0)
            return current == CampaignStatus.Paused ? CampaignStatus.Paused : CampaignStatus.Draft;

        var anyOpen = bookings.Any(b =>
            b.Status == BookingStatus.Pending ||
            b.Status == BookingStatus.Approved ||
            b.Status == BookingStatus.Active);

        if (anyOpen)
            // A manual pause holds while the campaign still has open bookings.
            return current == CampaignStatus.Paused ? CampaignStatus.Paused : CampaignStatus.Active;

        // Everything terminal: it ran if anything completed, otherwise it never aired.
        return bookings.Any(b => b.Status == BookingStatus.Completed)
            ? CampaignStatus.Completed
            : CampaignStatus.Cancelled;
    }

    /// <summary>Sub-state for UI/pings: what "Active" means right now.</summary>
    private static string CampaignSubState(List<Booking>? bookings, DateOnly today)
    {
        if (bookings == null || bookings.Count == 0) return "draft";
        if (bookings.Any(b => b.Status == BookingStatus.Active)) return "live";
        if (bookings.Any(b => b.Status == BookingStatus.Approved)) return "scheduled";
        if (bookings.Any(b => b.Status == BookingStatus.Pending)) return "awaiting-approval";
        return bookings.Any(b => b.Status == BookingStatus.Completed) ? "completed" : "cancelled";
    }

    private async Task UpdateCampaignStatusesAsync(CancellationToken ct)
    {
        try
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var campaigns = (await _campaignRepository.FindAsync(c => !c.IsDeleted, ct)).ToList();
            if (campaigns.Count == 0) return;

            var campaignBookings = (await _bookingRepository.FindAsync(
                    b => b.CampaignId != null && !b.IsDeleted, ct))
                .GroupBy(b => b.CampaignId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());

            var changed = 0;
            foreach (var campaign in campaigns)
            {
                campaignBookings.TryGetValue(campaign.Id, out var bookings);
                var derived = DeriveCampaignStatus(campaign.Status, bookings);
                if (derived == campaign.Status) continue;

                var oldStatus = campaign.Status;
                campaign.Status = derived;
                campaign.UpdatedAt = DateTime.UtcNow;
                await _campaignRepository.UpdateAsync(campaign, ct);
                changed++;

                _logger.LogInformation(
                    "Campaign {CampaignId} '{Name}': {Old} → {New}",
                    campaign.Id, campaign.Name, oldStatus, derived);

                var subState = CampaignSubState(bookings, today);
                await _notificationService.BroadcastCampaignEventAsync(campaign.Id,
                    "CampaignStatusChanged",
                    new { campaignId = campaign.Id.ToString(), status = derived.ToString(), subState });

                // Personal pings only for the endings — booking-level notifications
                // already cover the journey in.
                if (derived == CampaignStatus.Completed)
                {
                    await SafeNotifyAsync(campaign.AdvertiserId,
                        "Campaign completed",
                        $"'{campaign.Name}' has finished. Your delivery report and verified play log are ready.",
                        NotificationType.CampaignCompleted,
                        $"/reports/campaigns/{campaign.Id}");
                }
                else if (derived == CampaignStatus.Cancelled && oldStatus != CampaignStatus.Draft)
                {
                    await SafeNotifyAsync(campaign.AdvertiserId,
                        "Campaign didn't run",
                        $"'{campaign.Name}' ended without any booking airing. You can re-book the screens with fresh dates.",
                        NotificationType.SystemAlert,
                        $"/campaigns/{campaign.Id}");
                }
            }

            if (changed > 0)
            {
                await _unitOfWork.SaveChangesAsync(ct);
                _logger.LogInformation("Campaign lifecycle: {Count} campaign(s) transitioned", changed);
            }
        }
        catch (Exception ex)
        {
            // Best-effort: campaign derivation must never fail the booking sweep.
            _logger.LogError(ex, "Campaign lifecycle derivation failed");
        }
    }

    private async Task SafeNotifyAsync(Guid userId, string title, string message, NotificationType type, string url)
    {
        try { await _notificationService.CreateNotificationAsync(userId, title, message, type, url); }
        catch (Exception ex) { _logger.LogWarning(ex, "Campaign notification failed for {UserId}", userId); }
    }

    // ── Payout engine hooks ─────────────────────────────────────────────────

    private bool RequirePrepayment =>
        bool.TryParse(_configuration["Payments:RequirePrepayment"], out var v) && v;

    // Indexer + TryParse rather than GetValue<decimal>: CCMS.Application does
    // not reference Configuration.Binder (same constraint as the prepayment
    // flag reads elsewhere in this project).
    private decimal ConfigDecimal(string key, decimal fallback) =>
        decimal.TryParse(_configuration[key], out var value) && value > 0 ? value : fallback;

    private int ConfigInt(string key, int fallback) =>
        int.TryParse(_configuration[key], out var value) && value > 0 ? value : fallback;

    /// <summary>
    /// Approval SLA for Pending bookings. Advertisers' requests must not rot:
    /// the owner gets one reminder (Bookings:ApprovalReminderHours, default 24h,
    /// deduped via a notification marker), and the request auto-expires when it
    /// is older than the SLA (Bookings:ApprovalSlaHours, default 72h) or its
    /// whole booking window has passed — with both sides told why. A late
    /// approval within the window is still allowed until the SLA runs out.
    /// Returns true when the booking's status was changed.
    /// </summary>
    private async Task<bool> ApplyApprovalSlaAsync(
        Booking booking, DateOnly todayDate, DateTime now, CancellationToken ct)
    {
        var slaHours = ConfigInt("Bookings:ApprovalSlaHours", 72);
        var reminderHours = ConfigInt("Bookings:ApprovalReminderHours", 24);
        var ageHours = (now - booking.CreatedAt).TotalHours;

        var windowPassed = todayDate > booking.EndDate;
        var slaPassed = ageHours >= slaHours;

        if (windowPassed || slaPassed)
        {
            booking.Status = BookingStatus.Cancelled;
            booking.CancellationReason = windowPassed
                ? "Auto-expired: booking period ended without approval"
                : $"Auto-expired: not approved within the {slaHours}h approval window";
            booking.CancelledAt = now;
            booking.UpdatedAt = now;
            await _bookingRepository.UpdateAsync(booking, ct);

            _logger.LogInformation(
                "Booking {BookingId} auto-expired: Pending → Cancelled ({Reason})",
                booking.Id, booking.CancellationReason);

            try
            {
                var screen = await _screenRepository.GetByIdAsync(booking.ScreenId, ct);
                if (screen != null)
                {
                    await _notificationService.CreateNotificationAsync(
                        screen.OwnerId,
                        "Booking request expired",
                        $"A {booking.Currency} {booking.TotalPrice:N0} request for '{screen.Name}' expired unapproved. " +
                        "Approving faster keeps advertisers coming back.",
                        NotificationType.BookingCancelled,
                        "/bookings", booking.Id, "Booking");

                    if (booking.CampaignId.HasValue)
                    {
                        var campaign = await _campaignRepository.GetByIdAsync(booking.CampaignId.Value, ct);
                        if (campaign != null)
                        {
                            await _notificationService.CreateNotificationAsync(
                                campaign.AdvertiserId,
                                "Booking request expired",
                                $"Your booking request for '{screen.Name}' was not approved in time and has expired. " +
                                "You can book the screen again with fresh dates.",
                                NotificationType.BookingCancelled,
                                $"/bookings/{booking.Id}", booking.Id, "Booking");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "SLA expiry notification failed for booking {BookingId}", booking.Id);
            }
            return true;
        }

        // Reminder while still actionable — once, tracked by a notification marker.
        if (ageHours >= reminderHours)
        {
            try
            {
                var alreadyReminded = (await _notificationRepository.FindAsync(n =>
                    n.ReferenceId == booking.Id && n.ReferenceType == "ApprovalReminder", ct)).Any();
                if (!alreadyReminded)
                {
                    var screen = await _screenRepository.GetByIdAsync(booking.ScreenId, ct);
                    if (screen != null)
                    {
                        var hoursLeft = Math.Max(1, (int)(slaHours - ageHours));
                        await _notificationService.CreateNotificationAsync(
                            screen.OwnerId,
                            "Booking waiting for your approval",
                            $"A {booking.Currency} {booking.TotalPrice:N0} request for '{screen.Name}' has been waiting " +
                            $"{(int)ageHours}h. It expires in about {hoursLeft}h if not approved.",
                            NotificationType.BookingCreated,
                            $"/bookings?review={booking.Id}", booking.Id, "ApprovalReminder");
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "SLA reminder failed for booking {BookingId}", booking.Id);
            }
        }
        return false;
    }

    /// <summary>
    /// Created the moment the booking goes Active — the "you had half your money
    /// before you delivered the service" promise. Skipped for zero-price and
    /// internally-settled bookings. When prepayment is enforced, the advance is
    /// only recorded once the advertiser's payment was actually captured; while
    /// online payments are disabled, it is recorded with an honest note instead
    /// of a fake paid state.
    /// </summary>
    private async Task TryCreateAdvancePayoutAsync(Booking booking, Screen screen, CancellationToken ct)
    {
        try
        {
            if (booking.TotalPrice <= 0) return;
            if (booking.Source == BookingSource.SelfReserved && booking.IsInternalPayment) return;
            if (RequirePrepayment && booking.PaymentStatus != PaymentStatus.Captured)
            {
                _logger.LogInformation(
                    "Advance payout deferred for booking {BookingId}: prepayment required but not captured yet",
                    booking.Id);
                return;
            }

            var existing = await _payoutRepository.FindAsync(
                p => p.BookingId == booking.Id && p.Type == PayoutType.Advance && !p.IsDeleted, ct);
            if (existing.Any()) return;

            var advancePercentage = ConfigDecimal("Platform:DefaultAdvancePercentage", 50m);
            var commissionPercentage = screen.CommissionPercentage > 0
                ? screen.CommissionPercentage
                : ConfigDecimal("Platform:CommissionPercentage", 10m);

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
                AdminNotes = RequirePrepayment
                    ? "Created automatically on booking activation."
                    : "Created automatically on booking activation. Online payments are currently disabled — payable when payment collection goes live.",
                CreatedAt = DateTime.UtcNow,
            };
            await _payoutRepository.AddAsync(payout, ct);

            _logger.LogInformation(
                "Advance payout recorded on activation: booking {BookingId}, net {Currency} {Net:N2}",
                booking.Id, payout.Currency, netAmount);

            await SafeNotifyOwnerAsync(screen.OwnerId,
                "Advance payout recorded",
                $"{payout.Currency} {netAmount:N2} advance recorded for the booking that just started on '{screen.Name}'.",
                NotificationType.PayoutAdvanceProcessed);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create advance payout for booking {BookingId}", booking.Id);
        }
    }

    /// <summary>
    /// Created when the booking completes, sized by actual delivery:
    /// ≥95% delivered → full remaining net; 80–94% → pro-rata; below 80% →
    /// recorded but flagged for review with the numbers visible. Delivery is
    /// measured from impressions recorded for the booking vs its expected
    /// impressions — the same numbers both sides see live during the campaign.
    /// </summary>
    private async Task TryCreateFinalPayoutAsync(Booking booking, Screen screen, CancellationToken ct)
    {
        try
        {
            if (booking.TotalPrice <= 0) return;
            if (booking.Source == BookingSource.SelfReserved && booking.IsInternalPayment) return;

            var existing = await _payoutRepository.FindAsync(
                p => p.BookingId == booking.Id && (p.Type == PayoutType.Final || p.Type == PayoutType.Full) && !p.IsDeleted, ct);
            if (existing.Any()) return;

            var delivered = await _impressionRepository.CountAsync(
                i => i.BookingId == booking.Id && !i.IsDeleted, ct);
            var expected = booking.ExpectedImpressions;
            var deliveryPct = expected > 0 ? Math.Min(100m, delivered * 100m / expected) : 100m;

            var advance = (await _payoutRepository.FindAsync(
                p => p.BookingId == booking.Id && p.Type == PayoutType.Advance && !p.IsDeleted, ct)).FirstOrDefault();
            var advanceGross = advance?.GrossAmount ?? 0m;

            var commissionPercentage = advance?.CommissionPercentage
                ?? (screen.CommissionPercentage > 0
                    ? screen.CommissionPercentage
                    : ConfigDecimal("Platform:CommissionPercentage", 10m));

            var remainingGross = booking.TotalPrice - advanceGross;
            if (remainingGross < 0) remainingGross = 0;

            var deliveryFactor = deliveryPct >= 95m ? 1m : deliveryPct / 100m;
            var grossAmount = Math.Round(remainingGross * deliveryFactor, 2);
            var commissionAmount = Math.Round(grossAmount * (commissionPercentage / 100m), 2);
            var netAmount = grossAmount - commissionAmount;

            var deliveryNote =
                $"Delivery: {delivered:N0}/{expected:N0} plays ({deliveryPct:F1}%). " +
                (deliveryPct >= 95m ? "Full remaining payout."
                 : deliveryPct >= 80m ? "Pro-rata payout for partial delivery."
                 : "HELD FOR REVIEW: delivery below 80% — verify player uptime before processing.");
            if (!RequirePrepayment)
                deliveryNote += " Online payments are currently disabled — payable when payment collection goes live.";

            var payout = new Payout
            {
                ScreenOwnerId = screen.OwnerId,
                BookingId = booking.Id,
                Type = advance == null ? PayoutType.Full : PayoutType.Final,
                AdvancePercentage = advance?.AdvancePercentage ?? 0m,
                GrossAmount = grossAmount,
                CommissionPercentage = commissionPercentage,
                CommissionAmount = commissionAmount,
                NetAmount = netAmount,
                Currency = booking.Currency,
                Status = PayoutStatus.Pending,
                PeriodStart = booking.StartDate,
                PeriodEnd = booking.EndDate,
                AdminNotes = deliveryNote,
                CreatedAt = DateTime.UtcNow,
            };
            await _payoutRepository.AddAsync(payout, ct);

            _logger.LogInformation(
                "Final payout recorded on completion: booking {BookingId}, delivery {Pct:F1}%, net {Currency} {Net:N2}",
                booking.Id, deliveryPct, payout.Currency, netAmount);

            await SafeNotifyOwnerAsync(screen.OwnerId,
                "Final payout recorded",
                $"Campaign on '{screen.Name}' completed at {deliveryPct:F0}% delivery — {payout.Currency} {netAmount:N2} final payout recorded.",
                NotificationType.PayoutFinalPending);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create final payout for booking {BookingId}", booking.Id);
        }
    }

    private async Task SafeNotifyOwnerAsync(Guid ownerId, string title, string message, NotificationType type)
    {
        try
        {
            await _notificationService.CreateNotificationAsync(ownerId, title, message, type, "/payouts");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Payout notification failed (payout already recorded)");
        }
    }

    /// <summary>
    /// Determines the appropriate status for a booking based on current date/time and screen schedule.
    /// </summary>
    private BookingStatus DetermineBookingStatus(Booking booking, Screen screen, DateTime now)
    {
        var today = DateOnly.FromDateTime(now);
        var currentTime = now.TimeOfDay;

        // Check if we're before the booking period
        if (today < booking.StartDate)
        {
            return booking.Status; // Keep current status (should be Approved)
        }

        // Check if we're after the booking period
        if (today > booking.EndDate)
        {
            return BookingStatus.Completed;
        }

        // We're within the booking date range
        var currentDaySchedule = screen.Schedule.GetScheduleForDay(now.DayOfWeek);

        // If screen is not operating today
        if (!currentDaySchedule.IsOperating)
        {
            // If we were Active but screen is not operating, stay Active (will complete when period ends)
            // If we were Approved and screen is not operating, stay Approved (will activate when operating)
            return booking.Status;
        }

        // Check if we're on the end date
        if (today == booking.EndDate)
        {
            // If current time is past the end of operating hours, mark as completed
            if (currentTime >= currentDaySchedule.EndTime)
            {
                return BookingStatus.Completed;
            }
        }

        // Check if we're on the start date
        if (today == booking.StartDate)
        {
            // If current time is before operating hours start, stay Approved
            if (currentTime < currentDaySchedule.StartTime)
            {
                return BookingStatus.Approved;
            }
        }

        // We're within the booking period and within operating hours
        // OR we're after start date/time but before end date/time
        if ((today > booking.StartDate || 
            (today == booking.StartDate && currentTime >= currentDaySchedule.StartTime)) &&
            (today < booking.EndDate || 
            (today == booking.EndDate && currentTime < currentDaySchedule.EndTime)))
        {
            // Check if we're currently within operating hours
            if (currentTime >= currentDaySchedule.StartTime && currentTime < currentDaySchedule.EndTime)
            {
                return BookingStatus.Active;
            }
        }

        // Default: keep current status
        return booking.Status;
    }
}
