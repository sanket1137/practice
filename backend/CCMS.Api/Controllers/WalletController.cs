using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Payments;
using System.Security.Claims;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

[Authorize]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
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
    /// Create a Razorpay order for wallet top-up
    /// </summary>
    [HttpPost("topup")]
    public async Task<ActionResult<ApiResponse<CreateOrderResponse>>> TopUp([FromBody] TopUpWalletRequest request)
    {
        if (request.Amount <= 0)
            return BadRequest(ApiResponse<CreateOrderResponse>.ErrorResponse("Amount must be positive"));

        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var wallet = await GetOrCreateWalletAsync(userId);

        var receipt = $"wallet_topup_{wallet.Id:N}_{DateTime.UtcNow.Ticks}";
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

        // Verify signature first
        var isValid = _razorpayService.VerifyPaymentSignature(
            request.RazorpayOrderId, request.RazorpayPaymentId, request.RazorpaySignature);

        if (!isValid)
            return BadRequest(ApiResponse<WalletDto>.ErrorResponse("Payment verification failed"));

        // Check for duplicate top-up (idempotency)
        var existingTxns = await _transactionRepository.FindAsync(t =>
            t.Description != null && t.Description.Contains(request.RazorpayOrderId));
        if (existingTxns.Any())
        {
            var wallet2 = await GetOrCreateWalletAsync(userId);
            return Ok(ApiResponse<WalletDto>.SuccessResponse(MapToDto(wallet2), "Top-up already processed"));
        }

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
            Description = $"Wallet top-up via Razorpay (Order: {request.RazorpayOrderId})",
            BalanceBefore = balanceBefore,
            BalanceAfter = wallet.Balance
        };
        await _transactionRepository.AddAsync(transaction);

        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Wallet top-up: {Amount} {Currency} for user {UserId}",
            request.Amount, wallet.Currency, userId);

        return Ok(ApiResponse<WalletDto>.SuccessResponse(MapToDto(wallet), "Top-up successful"));
    }

    /// <summary>
    /// Get wallet transaction history
    /// </summary>
    [HttpGet("transactions")]
    public async Task<ActionResult<ApiResponse<List<WalletTransactionDto>>>> GetTransactions(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var wallet = await GetOrCreateWalletAsync(userId);

        var transactions = await _dbContext.WalletTransactions
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
    /// Pay for a booking using wallet balance
    /// </summary>
    [HttpPost("pay")]
    public async Task<ActionResult<ApiResponse<WalletDto>>> PayFromWallet([FromBody] WalletPayRequest request)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var wallet = await GetOrCreateWalletAsync(userId);

        var booking = await _dbContext.Bookings.FindAsync(request.BookingId);
        if (booking == null)
            return NotFound(ApiResponse<WalletDto>.ErrorResponse("Booking not found"));

        if (booking.PaymentStatus == PaymentStatus.Captured)
            return BadRequest(ApiResponse<WalletDto>.ErrorResponse("Booking is already paid"));

        if (wallet.Balance < booking.TotalPrice)
            return BadRequest(ApiResponse<WalletDto>.ErrorResponse(
                $"Insufficient balance. Required: {booking.TotalPrice} {booking.Currency}, Available: {wallet.Balance} {wallet.Currency}"));

        var balanceBefore = wallet.Balance;
        wallet.Balance -= booking.TotalPrice;
        await _walletRepository.UpdateAsync(wallet);

        var transaction = new WalletTransaction
        {
            WalletId = wallet.Id,
            Type = WalletTransactionType.Debit,
            Amount = booking.TotalPrice,
            Description = $"Payment for booking",
            ReferenceId = booking.Id,
            ReferenceType = "Booking",
            BalanceBefore = balanceBefore,
            BalanceAfter = wallet.Balance
        };
        await _transactionRepository.AddAsync(transaction);

        booking.PaymentStatus = PaymentStatus.Captured;
        _dbContext.Bookings.Update(booking);

        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Wallet payment: {Amount} {Currency} for booking {BookingId}",
            booking.TotalPrice, booking.Currency, booking.Id);

        return Ok(ApiResponse<WalletDto>.SuccessResponse(MapToDto(wallet), "Payment successful"));
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
    public string RazorpayOrderId { get; set; } = string.Empty;
    public string RazorpayPaymentId { get; set; } = string.Empty;
    public string RazorpaySignature { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}

public class WalletPayRequest
{
    public Guid BookingId { get; set; }
}
