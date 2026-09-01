using AutoMapper;
using MediatR;
using Microsoft.Extensions.Configuration;
using CCMS.Application.Interfaces;
using CCMS.Application.Services;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Campaigns;

namespace CCMS.Application.Features.Campaigns.Commands;

public class CreateCampaignWizardCommand : IRequest<CampaignWizardResult>
{
    public Guid UserId { get; set; }
    public CampaignWizardRequest Request { get; set; } = null!;
}

public class CreateCampaignWizardCommandHandler : IRequestHandler<CreateCampaignWizardCommand, CampaignWizardResult>
{
    private readonly IRepository<Campaign> _campaignRepository;
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Creative> _creativeRepository;
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<Wallet> _walletRepository;
    private readonly IRepository<WalletTransaction> _transactionRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly BookingCalculationService _calculationService;
    private readonly CreativeValidationService _validationService;
    private readonly SlotAvailabilityService _slotAvailabilityService;
    private readonly IBookingNotificationService _bookingNotificationService;

    /// <summary>
    /// When false (the default), the wizard books without taking payment: no wallet
    /// balance is required or debited, and bookings are created with
    /// PaymentStatus.None so nothing downstream treats them as paid — notably
    /// PayoutsController, which only pays screen owners for Captured bookings.
    /// Flip Payments:RequirePrepayment to true once the Razorpay flow is wired up
    /// to restore the wallet-debit behaviour.
    /// </summary>
    private readonly bool _requirePrepayment;

    public CreateCampaignWizardCommandHandler(
        IRepository<Campaign> campaignRepository,
        IRepository<Booking> bookingRepository,
        IRepository<Screen> screenRepository,
        IRepository<Creative> creativeRepository,
        IRepository<User> userRepository,
        IRepository<Wallet> walletRepository,
        IRepository<WalletTransaction> transactionRepository,
        IUnitOfWork unitOfWork,
        BookingCalculationService calculationService,
        CreativeValidationService validationService,
        SlotAvailabilityService slotAvailabilityService,
        IBookingNotificationService bookingNotificationService,
        IConfiguration configuration)
    {
        _bookingNotificationService = bookingNotificationService;
        // Indexer + TryParse rather than GetValue<bool>: this project doesn't
        // reference Configuration.Binder. Absent/unparseable => false (no prepayment).
        _requirePrepayment = bool.TryParse(configuration["Payments:RequirePrepayment"], out var requirePrepayment)
            && requirePrepayment;
        _campaignRepository = campaignRepository;
        _bookingRepository = bookingRepository;
        _screenRepository = screenRepository;
        _creativeRepository = creativeRepository;
        _userRepository = userRepository;
        _walletRepository = walletRepository;
        _transactionRepository = transactionRepository;
        _unitOfWork = unitOfWork;
        _calculationService = calculationService;
        _validationService = validationService;
        _slotAvailabilityService = slotAvailabilityService;
    }

    public async Task<CampaignWizardResult> Handle(CreateCampaignWizardCommand command, CancellationToken cancellationToken)
    {
        var req = command.Request;

        if (!DateOnly.TryParse(req.StartDate, out var startDate))
            throw new InvalidOperationException($"Invalid start date format: {req.StartDate}. Expected YYYY-MM-DD.");

        if (!DateOnly.TryParse(req.EndDate, out var endDate))
            throw new InvalidOperationException($"Invalid end date format: {req.EndDate}. Expected YYYY-MM-DD.");

        if (req.Bookings.Count == 0)
            throw new InvalidOperationException("At least one screen booking is required.");

        // ── Wallet pre-check (read-only, outside transaction) ──────────────────
        // Only looked up when prepayment is actually required; the exact balance
        // check still happens inside the transaction, after totals are calculated.
        Wallet? wallet = null;
        if (_requirePrepayment)
        {
            var existingWallets = await _walletRepository.FindAsync(w => w.UserId == command.UserId, cancellationToken);
            wallet = existingWallets.FirstOrDefault();
        }

        // ── Pre-validate all screens and creatives (outside transaction) ────────
        var bookingPlans = new List<(CampaignWizardBookingRequest Req, Screen Screen, Creative Creative, int SlotNumber, decimal TotalPrice, List<DateTime> BookedDates, int TotalImpressions)>();

        foreach (var bookingReq in req.Bookings)
        {
            var screen = await _screenRepository.GetByIdAsync(bookingReq.ScreenId, cancellationToken);
            if (screen == null)
                throw new InvalidOperationException($"Screen {bookingReq.ScreenId} not found.");

            if (screen.VerificationStatus != ScreenVerificationStatus.Verified)
                throw new InvalidOperationException($"Screen '{screen.Name}' is not yet verified and cannot accept bookings.");

            if (screen.Status != ScreenStatus.Active)
                throw new InvalidOperationException($"Screen '{screen.Name}' is not open for booking right now (status: {screen.Status}).");

            var screenOwner = await _userRepository.GetByIdAsync(screen.OwnerId, cancellationToken);
            if (screenOwner?.AccountVisibility == ScreenVisibility.Private)
                throw new InvalidOperationException($"Screen owner for '{screen.Name}' is not accepting public bookings.");

            if (screen.Currency != req.Currency)
                throw new InvalidOperationException($"Currency mismatch: campaign uses {req.Currency} but screen '{screen.Name}' prices in {screen.Currency}.");

            var creative = await _creativeRepository.GetByIdAsync(bookingReq.CreativeId, cancellationToken);
            if (creative == null)
                throw new InvalidOperationException($"Creative {bookingReq.CreativeId} not found.");

            var validation = await _validationService.ValidateCreativeForScreen(creative.Id, screen.Id, cancellationToken);
            if (!validation.IsCompatible)
                throw new InvalidOperationException($"Creative is not compatible with screen '{screen.Name}': {string.Join(", ", validation.Errors)}");

            // Auto-assign slot
            var availableSlot = await _slotAvailabilityService.FindPartiallyAvailableSlot(
                screen.Id,
                startDate.ToDateTime(TimeOnly.MinValue),
                endDate.ToDateTime(TimeOnly.MinValue),
                cancellationToken);

            if (!availableSlot.HasValue)
                throw new InvalidOperationException($"No available slots for screen '{screen.Name}' in the selected date range. All slots are fully booked.");

            var slotNumber = availableSlot.Value;

            var calculation = await _calculationService.CalculateBookingWithAvailability(
                screen,
                slotNumber,
                startDate.ToDateTime(TimeOnly.MinValue),
                endDate.ToDateTime(TimeOnly.MinValue),
                _slotAvailabilityService,
                cancellationToken);

            if (calculation.BookableDays == 0)
                throw new InvalidOperationException($"No available days for screen '{screen.Name}' in the selected date range.");

            var bookedDates = calculation.DailyBreakdown
                .Where(d => d.IsAvailable && d.Frames > 0)
                .Select(d => d.Date)
                .ToList();

            bookingPlans.Add((bookingReq, screen, creative, slotNumber, calculation.TotalCost, bookedDates, calculation.TotalExpectedImpressions));
        }

        var totalAmount = bookingPlans.Sum(p => p.TotalPrice);

        if (totalAmount > req.Budget)
            throw new InvalidOperationException($"Total booking cost ({totalAmount:F2} {req.Currency}) exceeds campaign budget ({req.Budget:F2} {req.Currency}).");

        // ── Atomic transaction ──────────────────────────────────────────────────
        // Runs as a single retriable unit. Connection resiliency is enabled
        // (EnableRetryOnFailure in Program.cs), and a retrying execution strategy
        // refuses to replay a hand-rolled BeginTransaction — which is exactly what
        // made every campaign-wizard request fail with "does not support
        // user-initiated transactions". Everything the unit touches is created
        // inside this delegate, so a retry replays cleanly.
        var wizardResult = await _unitOfWork.ExecuteInTransactionAsync(async ct =>
        {
            // 1. Create campaign
            var campaign = new Campaign
            {
                AdvertiserId = command.UserId,
                Name = req.Name,
                Description = req.Description ?? string.Empty,
                Budget = req.Budget,
                Currency = req.Currency,
                StartDate = startDate,
                EndDate = endDate,
                Status = CampaignStatus.Draft,
                CreatedAt = DateTime.UtcNow,
            };
            await _campaignRepository.AddAsync(campaign, cancellationToken);

            // 2. Create bookings
            var createdBookings = new List<Booking>();
            foreach (var plan in bookingPlans)
            {
                var booking = new Booking
                {
                    ScreenId = plan.Screen.Id,
                    CampaignId = campaign.Id,
                    CreativeId = plan.Creative.Id,
                    StartDate = startDate,
                    EndDate = endDate,
                    SlotNumbers = new List<int> { plan.SlotNumber },
                    Status = BookingStatus.Pending,
                    // Never claim money was captured when no payment was taken —
                    // PayoutsController pays screen owners off this exact flag.
                    PaymentStatus = _requirePrepayment ? PaymentStatus.Captured : PaymentStatus.None,
                    ExpectedImpressions = plan.TotalImpressions,
                    DeliveredImpressions = 0,
                    TotalPrice = plan.TotalPrice,
                    Currency = plan.Screen.Currency,
                    DailySlotAssignments = plan.BookedDates.ToDictionary(d => d, _ => plan.SlotNumber),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                };
                await _bookingRepository.AddAsync(booking, cancellationToken);
                createdBookings.Add(booking);
            }

            // 3. Wallet deduction — skipped entirely while prepayment is disabled,
            //    so a campaign can be booked without any wallet top-up. The booking
            //    still records its TotalPrice, so whatever payment flow lands later
            //    (Razorpay) has the amount owed to collect against.
            if (_requirePrepayment)
            {
                if (wallet == null)
                {
                    wallet = new Wallet
                    {
                        UserId = command.UserId,
                        Balance = 0,
                        Currency = req.Currency,
                    };
                    await _walletRepository.AddAsync(wallet, cancellationToken);
                    // Save so wallet gets an Id for WalletTransaction FK
                    await _unitOfWork.SaveChangesAsync(cancellationToken);
                    var refreshedWallets = await _walletRepository.FindAsync(w => w.UserId == command.UserId, cancellationToken);
                    wallet = refreshedWallets.First();
                }

                if (wallet.Balance < totalAmount)
                    throw new InvalidOperationException(
                        $"Insufficient wallet balance. Required: {totalAmount:F2} {req.Currency}, Available: {wallet.Balance:F2} {wallet.Currency}. Please top up your wallet.");

                var balanceBefore = wallet.Balance;
                wallet.Balance -= totalAmount;
                await _walletRepository.UpdateAsync(wallet, cancellationToken);

                var walletTx = new WalletTransaction
                {
                    WalletId = wallet.Id,
                    Type = WalletTransactionType.Debit,
                    Amount = totalAmount,
                    Description = $"Payment for campaign: {req.Name}",
                    ReferenceType = "Campaign",
                    BalanceBefore = balanceBefore,
                    BalanceAfter = wallet.Balance,
                };
                await _transactionRepository.AddAsync(walletTx, cancellationToken);
            }

            // 4. Flush so database-generated Ids are populated before the result is
            //    built. ExecuteInTransactionAsync owns the commit and the rollback.
            await _unitOfWork.SaveChangesAsync(ct);

            // 5. Build result
            return new CampaignWizardResult
            {
                CampaignId = campaign.Id,
                CampaignName = campaign.Name,
                TotalCharged = totalAmount,
                Currency = req.Currency,
                Bookings = createdBookings.Select((b, i) => new CampaignWizardBookingResult
                {
                    BookingId = b.Id,
                    ScreenId = b.ScreenId,
                    TotalPrice = b.TotalPrice,
                    Currency = b.Currency,
                }).ToList(),
            };
        }, cancellationToken);

        // ── Post-commit notifications ───────────────────────────────────────────
        // The direct booking flow (CreateBookingCommandHandler) notifies the screen
        // owner; wizard bookings used to skip this entirely, so owners never heard
        // about new requests until they happened to look. Runs strictly AFTER the
        // transaction commits — notifications must never fire (or be retried) for
        // a booking that ends up rolled back — and is best-effort per booking.
        // result.Bookings preserves bookingPlans order, so index-zip is safe.
        for (var i = 0; i < wizardResult.Bookings.Count && i < bookingPlans.Count; i++)
        {
            var plan = bookingPlans[i];
            var created = wizardResult.Bookings[i];
            try
            {
                await _bookingNotificationService.NotifyBookingCreatedAsync(new CCMS.Shared.DTOs.Bookings.BookingDto
                {
                    Id = created.BookingId,
                    ScreenId = plan.Screen.Id,
                    ScreenName = plan.Screen.Name,
                    CampaignId = wizardResult.CampaignId,
                    CampaignName = wizardResult.CampaignName,
                    AdvertiserId = command.UserId,
                    CreativeId = plan.Creative.Id,
                    CreativeName = plan.Creative.Name,
                    StartDate = startDate.ToString("yyyy-MM-dd"),
                    EndDate = endDate.ToString("yyyy-MM-dd"),
                    SlotNumbers = new List<int> { plan.SlotNumber },
                    Status = Domain.Enums.BookingStatus.Pending.ToString(),
                    TotalPrice = created.TotalPrice,
                    Currency = created.Currency,
                    CreatedAt = DateTime.UtcNow,
                }, plan.Screen.OwnerId);
            }
            catch (Exception)
            {
                // Never fail a successfully created campaign because a
                // notification could not be delivered.
            }
        }

        return wizardResult;
    }
}
