using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CCMS.Api.Security;
using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Payments;
using CCMS.Shared.DTOs.Payouts;
using System.Security.Claims;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

[Authorize]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
public class PayoutsController : ControllerBase
{
    private readonly IRepository<Payout> _payoutRepository;
    private readonly IRepository<BankAccount> _bankAccountRepository;
    private readonly ApplicationDbContext _dbContext;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IConfiguration _configuration;
    private readonly INotificationService _notificationService;
    private readonly ILogger<PayoutsController> _logger;

    public PayoutsController(
        IRepository<Payout> payoutRepository,
        IRepository<BankAccount> bankAccountRepository,
        ApplicationDbContext dbContext,
        IUnitOfWork unitOfWork,
        IConfiguration configuration,
        INotificationService notificationService,
        ILogger<PayoutsController> logger)
    {
        _payoutRepository = payoutRepository;
        _bankAccountRepository = bankAccountRepository;
        _dbContext = dbContext;
        _unitOfWork = unitOfWork;
        _configuration = configuration;
        _notificationService = notificationService;
        _logger = logger;
    }

    /// <summary>
    /// Get screen owner's earnings summary
    /// </summary>
    [HttpGet("summary")]
    public async Task<ActionResult<ApiResponse<PayoutSummaryDto>>> GetSummary()
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

        if (userRole != "ScreenOwner" && userRole != "Admin")
            return Forbid();

        var screenIds = await _dbContext.Screens
            .Where(s => s.OwnerId == userId && !s.IsDeleted)
            .Select(s => s.Id)
            .ToListAsync();

        var paidBookings = await _dbContext.Bookings
            .Where(b => screenIds.Contains(b.ScreenId) &&
                        !b.IsDeleted &&
                        b.PaymentStatus == PaymentStatus.Captured &&
                        b.Source == BookingSource.Platform)
            .Include(b => b.Screen)
            .ToListAsync();

        var defaultCommission = _configuration.GetValue<decimal>("Platform:DefaultCommissionPercentage", 15m);
        var grossTotal = paidBookings.Sum(b => b.TotalPrice);
        var commissionTotal = paidBookings.Sum(b =>
        {
            var commission = b.Screen?.CommissionPercentage ?? defaultCommission;
            return b.TotalPrice * (commission / 100m);
        });

        var payouts = await _dbContext.Payouts
            .Where(p => p.ScreenOwnerId == userId && !p.IsDeleted)
            .ToListAsync();

        return Ok(ApiResponse<PayoutSummaryDto>.SuccessResponse(new PayoutSummaryDto
        {
            TotalGrossEarnings = grossTotal,
            TotalCommission = commissionTotal,
            TotalNetEarnings = grossTotal - commissionTotal,
            CompletedPayoutAmount = payouts.Where(p => p.Status == PayoutStatus.Completed).Sum(p => p.NetAmount),
            PendingPayoutAmount = payouts.Where(p => p.Status == PayoutStatus.Pending || p.Status == PayoutStatus.Processing).Sum(p => p.NetAmount),
            Currency = "INR"
        }));
    }

    /// <summary>
    /// Get all pending payouts (Admin only)
    /// </summary>
    [HttpGet("pending")]
    public async Task<ActionResult<ApiResponse<List<PendingPayoutDto>>>> GetPending()
    {
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
        if (userRole != "Admin")
            return Forbid();

        var payouts = await _dbContext.Payouts
            .Where(p => !p.IsDeleted && (p.Status == PayoutStatus.Pending || p.Status == PayoutStatus.Processing))
            .OrderByDescending(p => p.CreatedAt)
            .Include(p => p.Booking)
                .ThenInclude(b => b!.Screen)
            .Include(p => p.Booking)
                .ThenInclude(b => b!.Campaign)
            .ToListAsync();

        var ownerIds = payouts.Select(p => p.ScreenOwnerId).Distinct().ToList();
        var owners = await _dbContext.Users.Where(u => ownerIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id);
        var bankAccounts = await _dbContext.BankAccounts.Where(b => ownerIds.Contains(b.UserId)).ToDictionaryAsync(b => b.UserId);

        var dtos = payouts.Select(p =>
        {
            owners.TryGetValue(p.ScreenOwnerId, out var owner);
            bankAccounts.TryGetValue(p.ScreenOwnerId, out var bank);

            return new PendingPayoutDto
            {
                Id = p.Id,
                BookingId = p.BookingId,
                PayoutType = p.Type.ToString(),
                ScreenName = p.Booking?.Screen?.Name ?? "N/A",
                CampaignName = p.Booking?.Campaign?.Name,
                ScreenOwnerName = owner != null ? $"{owner.FirstName} {owner.LastName}" : "Unknown",
                ScreenOwnerEmail = owner?.Email ?? "",
                GrossAmount = p.GrossAmount,
                CommissionPercentage = p.CommissionPercentage,
                CommissionAmount = p.CommissionAmount,
                NetAmount = p.NetAmount,
                AdvancePercentage = p.AdvancePercentage,
                Currency = p.Currency,
                Status = p.Status.ToString(),
                CreatedAt = p.CreatedAt,
                BankAccount = bank != null ? MapBankSnapshot(bank) : null
            };
        }).ToList();

        return Ok(ApiResponse<List<PendingPayoutDto>>.SuccessResponse(dtos));
    }

    /// <summary>
    /// Get single payout detail (Admin)
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<PayoutDetailDto>>> GetDetail(Guid id)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

        var payout = await _dbContext.Payouts
            .Include(p => p.Booking).ThenInclude(b => b!.Screen)
            .Include(p => p.Booking).ThenInclude(b => b!.Campaign)
            .Include(p => p.Booking).ThenInclude(b => b!.Creative)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

        if (payout == null)
            return NotFound(ApiResponse<PayoutDetailDto>.ErrorResponse("Payout not found"));

        // Screen owners can see their own payouts, admins can see all
        if (userRole != "Admin" && payout.ScreenOwnerId != userId)
            return Forbid();

        var owner = await _dbContext.Users.FindAsync(payout.ScreenOwnerId);
        var bankAccounts = await _bankAccountRepository.FindAsync(b => b.UserId == payout.ScreenOwnerId);
        var bank = bankAccounts.FirstOrDefault();

        // Related payouts for same booking
        var relatedPayouts = new List<RelatedPayoutDto>();
        if (payout.BookingId.HasValue)
        {
            relatedPayouts = await _dbContext.Payouts
                .Where(p => p.BookingId == payout.BookingId && p.Id != payout.Id && !p.IsDeleted)
                .Select(p => new RelatedPayoutDto
                {
                    Id = p.Id,
                    Type = p.Type.ToString(),
                    NetAmount = p.NetAmount,
                    Status = p.Status.ToString(),
                    CreatedAt = p.CreatedAt,
                    ProcessedAt = p.ProcessedAt
                })
                .ToListAsync();
        }

        // Impression count for booking
        var impressionCount = 0;
        if (payout.BookingId.HasValue)
        {
            impressionCount = await _dbContext.Impressions
                .CountAsync(i => i.BookingId == payout.BookingId);
        }

        var dto = new PayoutDetailDto
        {
            Id = payout.Id,
            ScreenOwnerId = payout.ScreenOwnerId,
            BookingId = payout.BookingId,
            PayoutType = payout.Type.ToString(),
            GrossAmount = payout.GrossAmount,
            CommissionPercentage = payout.CommissionPercentage,
            CommissionAmount = payout.CommissionAmount,
            NetAmount = payout.NetAmount,
            AdvancePercentage = payout.AdvancePercentage,
            Currency = payout.Currency,
            Status = payout.Status.ToString(),
            AdminNotes = payout.AdminNotes,
            CreatedAt = payout.CreatedAt,
            ProcessedAt = payout.ProcessedAt,
            Booking = payout.Booking != null ? new BookingSnapshotDto
            {
                Id = payout.Booking.Id,
                ScreenName = payout.Booking.Screen?.Name ?? "N/A",
                CampaignName = payout.Booking.Campaign?.Name,
                CreativeName = payout.Booking.Creative?.Name,
                StartDate = payout.Booking.StartDate.ToString("yyyy-MM-dd"),
                EndDate = payout.Booking.EndDate.ToString("yyyy-MM-dd"),
                TotalPrice = payout.Booking.TotalPrice,
                Status = payout.Booking.Status.ToString(),
                PaymentStatus = payout.Booking.PaymentStatus.ToString(),
                TotalImpressions = impressionCount
            } : null,
            ScreenOwner = owner != null ? new OwnerSnapshotDto
            {
                Id = owner.Id,
                Name = $"{owner.FirstName} {owner.LastName}",
                Email = owner.Email,
                Phone = owner.PhoneNumber,
                CompanyName = owner.CompanyName
            } : null,
            BankAccount = bank != null ? MapBankSnapshot(bank) : null,
            RelatedPayouts = relatedPayouts
        };

        return Ok(ApiResponse<PayoutDetailDto>.SuccessResponse(dto));
    }

    /// <summary>
    /// Process a payout — mark as completed (Admin only)
    /// </summary>
    [HttpPost("{id:guid}/process")]
    [RequireAuthorizedMachine]
    public async Task<ActionResult<ApiResponse<PayoutDetailDto>>> ProcessPayout(Guid id, [FromBody] ProcessPayoutRequest? request = null)
    {
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
        if (userRole != "Admin")
            return Forbid();

        var payout = await _payoutRepository.GetByIdAsync(id);
        if (payout == null)
            return NotFound(ApiResponse<PayoutDetailDto>.ErrorResponse("Payout not found"));

        if (payout.Status != PayoutStatus.Pending)
            return BadRequest(ApiResponse<PayoutDetailDto>.ErrorResponse("Payout is not in a processable state"));

        payout.Status = PayoutStatus.Completed;
        payout.ProcessedAt = DateTime.UtcNow;
        if (request?.AdminNotes != null)
            payout.AdminNotes = request.AdminNotes;

        await _payoutRepository.UpdateAsync(payout);
        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Payout processed: {PayoutId} ({Type}) for {Amount} INR to owner {OwnerId}",
            payout.Id, payout.Type, payout.NetAmount, payout.ScreenOwnerId);

        // Notify screen owner
        var notificationType = payout.Type == PayoutType.Advance
            ? NotificationType.PayoutAdvanceProcessed
            : NotificationType.PayoutFinalProcessed;
        var typeLabel = payout.Type == PayoutType.Advance ? "Advance" : "Final";

        await _notificationService.CreateNotificationAsync(
            payout.ScreenOwnerId,
            $"{typeLabel} Payout Processed",
            $"{typeLabel} payout of {payout.Currency} {payout.NetAmount:N2} has been processed to your bank account.",
            notificationType,
            $"/payouts/{payout.Id}",
            payout.Id,
            "Payout");

        // Notify advertiser if we have booking context
        if (payout.BookingId.HasValue)
        {
            var booking = await _dbContext.Bookings
                .Include(b => b.Campaign)
                .FirstOrDefaultAsync(b => b.Id == payout.BookingId);

            if (booking?.CampaignId.HasValue == true && booking.Campaign != null)
            {
                await _notificationService.CreateNotificationAsync(
                    booking.Campaign.AdvertiserId,
                    $"Booking Payment Update",
                    $"{typeLabel} payment of {payout.Currency} {payout.NetAmount:N2} processed to screen owner for your booking.",
                    notificationType,
                    $"/bookings/{booking.Id}",
                    booking.Id,
                    "Booking");
            }
        }

        return await GetDetail(id);
    }

    /// <summary>
    /// Mark payout as failed (Admin only)
    /// </summary>
    [HttpPost("{id:guid}/fail")]
    [RequireAuthorizedMachine]
    public async Task<ActionResult<ApiResponse<PayoutDetailDto>>> FailPayout(Guid id, [FromBody] FailPayoutRequest request)
    {
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
        if (userRole != "Admin")
            return Forbid();

        var payout = await _payoutRepository.GetByIdAsync(id);
        if (payout == null)
            return NotFound(ApiResponse<PayoutDetailDto>.ErrorResponse("Payout not found"));

        if (payout.Status != PayoutStatus.Pending)
            return BadRequest(ApiResponse<PayoutDetailDto>.ErrorResponse("Payout is not in a processable state"));

        payout.Status = PayoutStatus.Failed;
        payout.AdminNotes = request.Reason;
        payout.ProcessedAt = DateTime.UtcNow;
        await _payoutRepository.UpdateAsync(payout);
        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Payout failed: {PayoutId} reason: {Reason}", payout.Id, request.Reason);

        return await GetDetail(id);
    }

    /// <summary>
    /// Release final payment for a completed booking (Admin only).
    /// Creates a Final payout record after reviewing play logs.
    /// </summary>
    [HttpPost("bookings/{bookingId:guid}/release-final")]
    [RequireAuthorizedMachine]
    public async Task<ActionResult<ApiResponse<PayoutDetailDto>>> ReleaseFinalPayout(Guid bookingId, [FromBody] ReleasePayoutRequest? request = null)
    {
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
        if (userRole != "Admin")
            return Forbid();

        var booking = await _dbContext.Bookings
            .Include(b => b.Screen)
            .FirstOrDefaultAsync(b => b.Id == bookingId && !b.IsDeleted);

        if (booking == null)
            return NotFound(ApiResponse<PayoutDetailDto>.ErrorResponse("Booking not found"));

        if (booking.Status != BookingStatus.Completed && booking.Status != BookingStatus.Active)
            return BadRequest(ApiResponse<PayoutDetailDto>.ErrorResponse("Booking must be Active or Completed to release final payment"));

        // Check no existing pending/completed Final payout
        var existingFinal = await _dbContext.Payouts
            .AnyAsync(p => p.BookingId == bookingId && p.Type == PayoutType.Final && !p.IsDeleted
                          && (p.Status == PayoutStatus.Pending || p.Status == PayoutStatus.Completed));

        if (existingFinal)
            return BadRequest(ApiResponse<PayoutDetailDto>.ErrorResponse("Final payout already exists for this booking"));

        // Calculate remaining net after advance
        var advancePayout = await _dbContext.Payouts
            .FirstOrDefaultAsync(p => p.BookingId == bookingId && p.Type == PayoutType.Advance && !p.IsDeleted
                                     && p.Status == PayoutStatus.Completed);

        var defaultCommission = _configuration.GetValue<decimal>("Platform:DefaultCommissionPercentage", 15m);
        var commission = booking.Screen?.CommissionPercentage ?? defaultCommission;
        var gross = booking.TotalPrice;
        var commissionAmount = gross * (commission / 100m);
        var totalNet = gross - commissionAmount;
        var advancePaid = advancePayout?.NetAmount ?? 0m;
        var remainingNet = totalNet - advancePaid;

        // Allow admin to adjust for underdelivery
        var finalNet = request?.AdjustedNetAmount ?? remainingNet;
        if (finalNet < 0) finalNet = 0;
        if (finalNet > remainingNet) finalNet = remainingNet;

        var payout = new Payout
        {
            ScreenOwnerId = booking.Screen!.OwnerId,
            BookingId = bookingId,
            Type = PayoutType.Final,
            GrossAmount = gross,
            CommissionPercentage = commission,
            CommissionAmount = commissionAmount,
            NetAmount = finalNet,
            AdvancePercentage = 100 - (advancePayout?.AdvancePercentage ?? 0),
            Currency = booking.Currency ?? "INR",
            Status = PayoutStatus.Pending,
            AdminNotes = request?.AdminNotes
        };

        await _payoutRepository.AddAsync(payout);
        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Final payout created: {PayoutId} for booking {BookingId}, amount {Amount}",
            payout.Id, bookingId, finalNet);

        // Notify screen owner
        await _notificationService.CreateNotificationAsync(
            booking.Screen.OwnerId,
            "Final Payout Pending",
            $"Final payout of {payout.Currency} {finalNet:N2} is pending for your booking on {booking.Screen.Name}.",
            NotificationType.PayoutFinalPending,
            $"/payouts/{payout.Id}",
            payout.Id,
            "Payout");

        return await GetDetail(payout.Id);
    }

    /// <summary>
    /// Get payout history (screen owners see their own, admins see all)
    /// </summary>
    [HttpGet("history")]
    public async Task<ActionResult<ApiResponse<List<PayoutDto>>>> GetHistory(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

        var query = _dbContext.Payouts
            .Where(p => !p.IsDeleted && p.Status == PayoutStatus.Completed)
            .AsQueryable();

        if (userRole != "Admin")
            query = query.Where(p => p.ScreenOwnerId == userId);

        var payouts = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var dtos = payouts.Select(p => new PayoutDto
        {
            Id = p.Id,
            ScreenOwnerId = p.ScreenOwnerId,
            GrossAmount = p.GrossAmount,
            CommissionPercentage = p.CommissionPercentage,
            CommissionAmount = p.CommissionAmount,
            NetAmount = p.NetAmount,
            Currency = p.Currency,
            Status = p.Status.ToString(),
            PeriodStart = p.PeriodStart,
            PeriodEnd = p.PeriodEnd,
            CreatedAt = p.CreatedAt,
            ProcessedAt = p.ProcessedAt
        }).ToList();

        return Ok(ApiResponse<List<PayoutDto>>.SuccessResponse(dtos));
    }

    private static BankAccountSnapshotDto MapBankSnapshot(BankAccount ba) => new()
    {
        BeneficiaryName = ba.BeneficiaryName,
        AccountNumberMasked = ba.AccountNumber.Length > 4
            ? new string('*', ba.AccountNumber.Length - 4) + ba.AccountNumber[^4..]
            : "****",
        IfscCode = ba.IfscCode,
        BankName = ba.BankName
    };
}
