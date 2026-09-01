using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using CCMS.Application.Interfaces;
using CCMS.Api.Extensions;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Payments;
using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

[Authorize]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[EnableRateLimiting(RateLimitingExtensions.ApiPolicy)]
public class WalletController : ControllerBase
{
    private readonly IRepository<Wallet> _walletRepository;
    private readonly IRepository<WalletTransaction> _transactionRepository;
    private readonly IRazorpayService _razorpayService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ApplicationDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<WalletController> _logger;

    public WalletController(
        IRepository<Wallet> walletRepository,
        IRepository<WalletTransaction> transactionRepository,
        IRazorpayService razorpayService,
        IUnitOfWork unitOfWork,
        ApplicationDbContext dbContext,
        IConfiguration configuration,
        ILogger<WalletController> logger)
    {
        _walletRepository = walletRepository;
        _transactionRepository = transactionRepository;
        _razorpayService = razorpayService;
        _unitOfWork = unitOfWork;
        _dbContext = dbContext;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Get current user's wallet (auto-creates if doesn't exist)
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<WalletDto>>> GetWallet()
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var wallet = await GetOrCreateWalletAsync(userId);

        return Ok(ApiResponse<WalletDto>.SuccessResponse(MapToDto(wallet)));
    }

    /// <summary>
    /// Lightweight alias for GET /wallet — returns the same WalletDto. Kept so callers
    /// asking for the explicit "balance" path keep working without duplicating logic.
    /// </summary>
    [HttpGet("balance")]
    public Task<ActionResult<ApiResponse<WalletDto>>> GetWalletBalance() => GetWallet();

    /// <summary>
    /// Create a Razorpay order for wallet top-up
    /// </summary>
    [HttpPost("topup")]
    public async Task<ActionResult<ApiResponse<CreateOrderResponse>>> TopUp([FromBody] TopUpWalletRequest request)
    {
        // Defensive amount validation — must mirror what we accept on confirm.
        if (request.Amount <= 0)
            return BadRequest(ApiResponse<CreateOrderResponse>.ErrorResponse("Amount must be positive"));
        if (request.Amount < 1m)
            return BadRequest(ApiResponse<CreateOrderResponse>.ErrorResponse("Minimum top-up amount is 1"));
        if (request.Amount > 1_000_000m)
            return BadRequest(ApiResponse<CreateOrderResponse>.ErrorResponse("Top-up amount exceeds maximum allowed"));
        // Reject more than 2 decimal places to avoid silent paise rounding.
        if (decimal.Round(request.Amount, 2) != request.Amount)
            return BadRequest(ApiResponse<CreateOrderResponse>.ErrorResponse("Amount must have at most 2 decimal places"));

        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var wallet = await GetOrCreateWalletAsync(userId);

        var receipt = $"wallet_topup_{wallet.Id:N}_{DateTime.UtcNow.Ticks}";

        try
        {
            var order = await _razorpayService.CreateOrderAsync(request.Amount, wallet.Currency, receipt);

            return Ok(ApiResponse<CreateOrderResponse>.SuccessResponse(new CreateOrderResponse
            {
                OrderId = order.OrderId,
                Amount = request.Amount,
                Currency = wallet.Currency,
                KeyId = _configuration["Razorpay:KeyId"]!,
                BookingId = Guid.Empty // Not a booking - wallet topup
            }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create Razorpay order for wallet top-up. User={UserId} Amount={Amount}",
                userId, request.Amount);
            return StatusCode(502, ApiResponse<CreateOrderResponse>.ErrorResponse(
                "Could not initiate payment. Please verify Razorpay configuration and try again."));
        }
    }

    /// <summary>
    /// Verify wallet top-up payment and credit balance
    /// </summary>
    [HttpPost("topup/verify")]
    public async Task<ActionResult<ApiResponse<WalletDto>>> VerifyTopUp([FromBody] VerifyPaymentRequest request)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var isValid = _razorpayService.VerifyPaymentSignature(
            request.RazorpayOrderId, request.RazorpayPaymentId, request.RazorpaySignature);

        if (!isValid)
            return BadRequest(ApiResponse<WalletDto>.ErrorResponse("Payment verification failed"));

        var wallet = await GetOrCreateWalletAsync(userId);

        // Use optimistic concurrency - retry on conflict
        var balanceBefore = wallet.Balance;
        wallet.Balance += request.BookingId == Guid.Empty ? 0 : 0; // Amount comes from order

        // We need the actual amount — fetch from Razorpay or from our pending records
        // For simplicity, decode from the order receipt or query Razorpay
        // The frontend sends the amount along with the verification

        return BadRequest(ApiResponse<WalletDto>.ErrorResponse("Use /api/wallet/topup/confirm endpoint with amount"));
    }

    /// <summary>
    /// Confirm wallet top-up with amount (called after Razorpay verification)
    /// </summary>
    [HttpPost("topup/confirm")]
    public async Task<ActionResult<ApiResponse<WalletDto>>> ConfirmTopUp([FromBody] WalletTopUpConfirmRequest request)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        // Server-side amount validation — the client must not be the source of truth, but until we
        // store the order amount in our own DB we re-validate the shape here.
        if (request.Amount <= 0 || request.Amount > 1_000_000m || decimal.Round(request.Amount, 2) != request.Amount)
            return BadRequest(ApiResponse<WalletDto>.ErrorResponse("Invalid amount"));

        if (string.IsNullOrWhiteSpace(request.RazorpayOrderId)
            || string.IsNullOrWhiteSpace(request.RazorpayPaymentId)
            || string.IsNullOrWhiteSpace(request.RazorpaySignature))
            return BadRequest(ApiResponse<WalletDto>.ErrorResponse("Missing payment identifiers"));

        // Verify Razorpay signature first — never credit the wallet without proof of payment.
        var isValid = _razorpayService.VerifyPaymentSignature(
            request.RazorpayOrderId, request.RazorpayPaymentId, request.RazorpaySignature);

        if (!isValid)
        {
            _logger.LogWarning(
                "Wallet top-up signature verification FAILED. User={UserId} Order={OrderId} Payment={PaymentId}",
                userId, request.RazorpayOrderId, request.RazorpayPaymentId);
            return BadRequest(ApiResponse<WalletDto>.ErrorResponse("Payment verification failed"));
        }

        // Strong idempotency key — exact match on ReferenceType + ReferenceId (we hash the order id
        // into a deterministic Guid so the existing schema can be reused without a migration).
        var idempotencyRef = OrderIdToReference(request.RazorpayOrderId);
        var existing = await _transactionRepository.FindAsync(t =>
            t.ReferenceType == "RazorpayTopUp" && t.ReferenceId == idempotencyRef);
        if (existing.Any())
        {
            var current = await GetOrCreateWalletAsync(userId);
            _logger.LogInformation(
                "Wallet top-up already processed (idempotent replay). User={UserId} Order={OrderId}",
                userId, request.RazorpayOrderId);
            return Ok(ApiResponse<WalletDto>.SuccessResponse(MapToDto(current), "Top-up already processed"));
        }

        // Atomic credit — wallet update + transaction insert must commit or roll back together.
        // ExecuteInTransactionAsync makes begin→work→commit one retriable unit under the
        // Npgsql retry strategy (a raw BeginTransactionAsync throws with EnableRetryOnFailure).
        try
        {
            return await _unitOfWork.ExecuteInTransactionAsync<ActionResult<ApiResponse<WalletDto>>>(async _ =>
            {
                var wallet = await GetOrCreateWalletAsync(userId);
                var balanceBefore = wallet.Balance;
                wallet.Balance += request.Amount;
                wallet.LastTopUpAt = DateTime.UtcNow;
                await _walletRepository.UpdateAsync(wallet);

                var transaction = new WalletTransaction
                {
                    WalletId = wallet.Id,
                    Type = WalletTransactionType.TopUp,
                    Amount = request.Amount,
                    Description = $"Wallet top-up via Razorpay (Order: {request.RazorpayOrderId}, Payment: {request.RazorpayPaymentId})",
                    ReferenceType = "RazorpayTopUp",
                    ReferenceId = idempotencyRef,
                    BalanceBefore = balanceBefore,
                    BalanceAfter = wallet.Balance
                };
                await _transactionRepository.AddAsync(transaction);

                _logger.LogInformation(
                    "Wallet top-up CREDITED. User={UserId} Amount={Amount} {Currency} NewBalance={NewBalance} Order={OrderId}",
                    userId, request.Amount, wallet.Currency, wallet.Balance, request.RazorpayOrderId);

                return Ok(ApiResponse<WalletDto>.SuccessResponse(MapToDto(wallet), "Top-up successful"));
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Wallet top-up FAILED during persistence. User={UserId} Order={OrderId} Amount={Amount}",
                userId, request.RazorpayOrderId, request.Amount);
            return StatusCode(500, ApiResponse<WalletDto>.ErrorResponse(
                "Payment was verified but crediting the wallet failed. Please contact support with order id: " + request.RazorpayOrderId));
        }
    }

    /// <summary>
    /// Deterministically project a Razorpay order id onto a Guid so it can be stored in the
    /// existing WalletTransaction.ReferenceId column as a strong idempotency key — avoiding a
    /// schema migration while still giving us exact-match duplicate detection.
    /// </summary>
    private static Guid OrderIdToReference(string razorpayOrderId)
    {
        using var sha = System.Security.Cryptography.SHA256.Create();
        var hash = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes("rzp_topup:" + razorpayOrderId));
        var bytes = new byte[16];
        Array.Copy(hash, bytes, 16);
        return new Guid(bytes);
    }

    /// <summary>
    /// Get wallet transaction history
    /// </summary>
    [HttpGet("transactions")]
    public async Task<ActionResult<ApiResponse<List<WalletTransactionDto>>>> GetTransactions(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        // Defensive pagination — clamp values so a caller can't request `pageSize=1000000` and DoS the DB.
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var wallet = await GetOrCreateWalletAsync(userId);

        var transactions = await _dbContext.WalletTransactions
            .AsNoTracking()
            .Where(t => t.WalletId == wallet.Id && !t.IsDeleted)
            .OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var dtos = transactions.Select(t => new WalletTransactionDto
        {
            Id = t.Id,
            Type = t.Type.ToString(),
            Amount = t.Amount,
            Description = t.Description,
            ReferenceId = t.ReferenceId,
            ReferenceType = t.ReferenceType,
            BalanceBefore = t.BalanceBefore,
            BalanceAfter = t.BalanceAfter,
            CreatedAt = t.CreatedAt
        }).ToList();

        return Ok(ApiResponse<List<WalletTransactionDto>>.SuccessResponse(dtos));
    }

    /// <summary>
    /// Pay for a booking using wallet balance.
    /// Enforces booking ownership via Campaign.AdvertiserId, wraps the wallet-debit /
    /// transaction-insert / booking-update in a single DB transaction, and is idempotent
    /// against the same booking being paid twice (a replay or concurrent request lands on
    /// the existing "Captured" status and is rejected — money cannot be double-debited).
    /// </summary>
    [HttpPost("pay")]
    public async Task<ActionResult<ApiResponse<WalletDto>>> PayFromWallet([FromBody] WalletPayRequest request)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        // Load the booking and verify ownership BEFORE entering the transaction. A booking
        // belongs to the advertiser who owns its parent campaign — that's the only entity
        // allowed to drain their own wallet to pay for it. Self-reserved bookings (no campaign)
        // are out of scope for wallet payment.
        var booking = await _dbContext.Bookings.FirstOrDefaultAsync(b => b.Id == request.BookingId && !b.IsDeleted);
        if (booking == null)
            return NotFound(ApiResponse<WalletDto>.ErrorResponse("Booking not found"));

        if (!booking.CampaignId.HasValue)
            return BadRequest(ApiResponse<WalletDto>.ErrorResponse("This booking cannot be paid from a wallet"));

        var campaign = await _dbContext.Campaigns.FirstOrDefaultAsync(c => c.Id == booking.CampaignId.Value && !c.IsDeleted);
        if (campaign == null || campaign.AdvertiserId != userId)
            return NotFound(ApiResponse<WalletDto>.ErrorResponse("Booking not found"));

        if (booking.PaymentStatus == PaymentStatus.Captured)
            return BadRequest(ApiResponse<WalletDto>.ErrorResponse("Booking is already paid"));
        if (booking.PaymentStatus == PaymentStatus.Refunded)
            return BadRequest(ApiResponse<WalletDto>.ErrorResponse("Booking has been refunded and cannot be paid again"));
        if (booking.Status == BookingStatus.Cancelled || booking.Status == BookingStatus.Rejected)
            return BadRequest(ApiResponse<WalletDto>.ErrorResponse("Booking is no longer active"));

        // Idempotency: if a Debit transaction already exists for this booking, reject — never debit twice.
        var existingDebit = await _dbContext.WalletTransactions
            .AnyAsync(t => t.ReferenceType == "Booking" && t.ReferenceId == booking.Id
                && t.Type == WalletTransactionType.Debit && !t.IsDeleted);
        if (existingDebit)
            return Conflict(ApiResponse<WalletDto>.ErrorResponse("This booking has already been debited"));

        try
        {
            // Retry-strategy-safe transaction; each attempt re-reads the wallet fresh, and
            // RowVersion-based optimistic concurrency still catches racing debits.
            return await _unitOfWork.ExecuteInTransactionAsync<ActionResult<ApiResponse<WalletDto>>>(async _ =>
            {
                var wallet = await _dbContext.Wallets.FirstOrDefaultAsync(w => w.UserId == userId)
                    ?? throw new InvalidOperationException("Wallet not found");

                if (wallet.Balance < booking.TotalPrice)
                {
                    return BadRequest(ApiResponse<WalletDto>.ErrorResponse(
                        $"Insufficient balance. Required: {booking.TotalPrice:F2} {booking.Currency}, Available: {wallet.Balance:F2} {wallet.Currency}"));
                }

                var balanceBefore = wallet.Balance;
                wallet.Balance -= booking.TotalPrice;
                // Don't call repository.UpdateAsync — it auto-saves and would break the transaction boundary.
                _dbContext.Wallets.Update(wallet);

                _dbContext.WalletTransactions.Add(new WalletTransaction
                {
                    WalletId = wallet.Id,
                    Type = WalletTransactionType.Debit,
                    Amount = booking.TotalPrice,
                    Description = $"Payment for booking {booking.Id}",
                    ReferenceId = booking.Id,
                    ReferenceType = "Booking",
                    BalanceBefore = balanceBefore,
                    BalanceAfter = wallet.Balance
                });

                booking.PaymentStatus = PaymentStatus.Captured;
                booking.PaymentMethod = "Wallet";
                booking.UpdatedAt = DateTime.UtcNow;
                _dbContext.Bookings.Update(booking);

                _logger.LogInformation(
                    "Wallet payment SUCCESS. User={UserId} Amount={Amount} {Currency} BookingId={BookingId} NewBalance={NewBalance}",
                    userId, booking.TotalPrice, booking.Currency, booking.Id, wallet.Balance);

                return Ok(ApiResponse<WalletDto>.SuccessResponse(MapToDto(wallet), "Payment successful"));
            });
        }
        catch (DbUpdateConcurrencyException ex)
        {
            _logger.LogWarning(ex,
                "Wallet payment CONCURRENCY conflict. User={UserId} BookingId={BookingId} — refusing to debit",
                userId, request.BookingId);
            return Conflict(ApiResponse<WalletDto>.ErrorResponse(
                "Wallet was updated by another request. Please refresh and try again."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Wallet payment FAILED. User={UserId} BookingId={BookingId}",
                userId, request.BookingId);
            return StatusCode(500, ApiResponse<WalletDto>.ErrorResponse(
                "Payment could not be processed. No money was debited. Please try again."));
        }
    }

    /// <summary>
    /// Pay for all pending bookings in a campaign using wallet balance (atomic, idempotent).
    /// Ownership: the campaign's `AdvertiserId` must equal the caller's user id.
    /// </summary>
    [HttpPost("pay-for-campaign")]
    public async Task<ActionResult<ApiResponse<WalletDto>>> PayForCampaign([FromBody] CampaignWalletPayRequest request)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var campaign = await _dbContext.Campaigns.FirstOrDefaultAsync(c => c.Id == request.CampaignId && !c.IsDeleted);
        if (campaign == null || campaign.AdvertiserId != userId)
            return NotFound(ApiResponse<WalletDto>.ErrorResponse("Campaign not found"));

        try
        {
            // Retry-strategy-safe transaction; every read below happens inside the unit so
            // each retry attempt sees fresh state and concurrent writers can't slip in.
            return await _unitOfWork.ExecuteInTransactionAsync<ActionResult<ApiResponse<WalletDto>>>(async _ =>
            {
                var wallet = await _dbContext.Wallets.FirstOrDefaultAsync(w => w.UserId == userId)
                    ?? throw new InvalidOperationException("Wallet not found");

                var bookings = await _dbContext.Bookings
                    .Where(b => b.CampaignId == request.CampaignId
                        && !b.IsDeleted
                        && b.PaymentStatus != PaymentStatus.Captured
                        && b.PaymentStatus != PaymentStatus.Refunded
                        && b.Status != BookingStatus.Cancelled
                        && b.Status != BookingStatus.Rejected)
                    .ToListAsync();

                if (!bookings.Any())
                {
                    return BadRequest(ApiResponse<WalletDto>.ErrorResponse("No unpaid bookings found for this campaign"));
                }

                // Idempotency at campaign level — a successful campaign debit writes one row with
                // ReferenceType="Campaign". Reject if it's already there.
                var campaignDebited = await _dbContext.WalletTransactions
                    .AnyAsync(t => t.ReferenceType == "Campaign" && t.ReferenceId == request.CampaignId
                        && t.Type == WalletTransactionType.Debit && !t.IsDeleted);
                if (campaignDebited)
                {
                    return Conflict(ApiResponse<WalletDto>.ErrorResponse("Campaign has already been paid from wallet"));
                }

                var totalAmount = bookings.Sum(b => b.TotalPrice);
                if (wallet.Balance < totalAmount)
                {
                    return BadRequest(ApiResponse<WalletDto>.ErrorResponse(
                        $"Insufficient balance. Required: {totalAmount:F2} {wallet.Currency}, Available: {wallet.Balance:F2} {wallet.Currency}"));
                }

                var balanceBefore = wallet.Balance;
                wallet.Balance -= totalAmount;
                _dbContext.Wallets.Update(wallet);

                _dbContext.WalletTransactions.Add(new WalletTransaction
                {
                    WalletId = wallet.Id,
                    Type = WalletTransactionType.Debit,
                    Amount = totalAmount,
                    Description = $"Payment for campaign: {campaign.Name}",
                    ReferenceId = request.CampaignId,
                    ReferenceType = "Campaign",
                    BalanceBefore = balanceBefore,
                    BalanceAfter = wallet.Balance
                });

                foreach (var booking in bookings)
                {
                    booking.PaymentStatus = PaymentStatus.Captured;
                    booking.PaymentMethod = "Wallet";
                    booking.UpdatedAt = DateTime.UtcNow;
                    _dbContext.Bookings.Update(booking);
                }

                _logger.LogInformation(
                    "Wallet campaign payment SUCCESS. User={UserId} CampaignId={CampaignId} Amount={Amount} Bookings={Count}",
                    userId, request.CampaignId, totalAmount, bookings.Count);

                return Ok(ApiResponse<WalletDto>.SuccessResponse(MapToDto(wallet),
                    $"Payment of {totalAmount:F2} {wallet.Currency} successful for {bookings.Count} booking(s)"));
            });
        }
        catch (DbUpdateConcurrencyException ex)
        {
            _logger.LogWarning(ex,
                "Wallet campaign payment CONCURRENCY conflict. User={UserId} CampaignId={CampaignId}",
                userId, request.CampaignId);
            return Conflict(ApiResponse<WalletDto>.ErrorResponse(
                "Wallet was updated by another request. Please refresh and try again."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Wallet campaign payment FAILED. User={UserId} CampaignId={CampaignId}",
                userId, request.CampaignId);
            return StatusCode(500, ApiResponse<WalletDto>.ErrorResponse(
                "Payment could not be processed. No money was debited. Please try again."));
        }
    }

    private async Task<Wallet> GetOrCreateWalletAsync(Guid userId)
    {
        var wallets = await _walletRepository.FindAsync(w => w.UserId == userId);
        var wallet = wallets.FirstOrDefault();

        if (wallet == null)
        {
            wallet = new Wallet
            {
                UserId = userId,
                Balance = 0,
                Currency = "INR"
            };
            await _walletRepository.AddAsync(wallet);
            await _unitOfWork.SaveChangesAsync();
        }

        return wallet;
    }

    private static WalletDto MapToDto(Wallet w) => new()
    {
        Id = w.Id,
        Balance = w.Balance,
        Currency = w.Currency,
        LastTopUpAt = w.LastTopUpAt
    };
}

public class WalletTopUpConfirmRequest
{
    [Required, StringLength(200)]
    public string RazorpayOrderId { get; set; } = string.Empty;
    [Required, StringLength(200)]
    public string RazorpayPaymentId { get; set; } = string.Empty;
    [Required, StringLength(500)]
    public string RazorpaySignature { get; set; } = string.Empty;
    [Range(1, double.MaxValue)]
    public decimal Amount { get; set; }
}

public class WalletPayRequest
{
    [Required]
    public Guid BookingId { get; set; }
}

public class CampaignWalletPayRequest
{
    [Required]
    public Guid CampaignId { get; set; }
}
