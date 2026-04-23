using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Profile;
using System.Security.Claims;
using System.Text.RegularExpressions;
using Asp.Versioning;

namespace CCMS.Api.Controllers;

[Authorize]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
public class ProfileController : ControllerBase
{
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<BankAccount> _bankAccountRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IFileStorageService _fileStorageService;
    private readonly INotificationService _notificationService;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ProfileController> _logger;

    public ProfileController(
        IRepository<User> userRepository,
        IRepository<BankAccount> bankAccountRepository,
        IUnitOfWork unitOfWork,
        IFileStorageService fileStorageService,
        INotificationService notificationService,
        ApplicationDbContext context,
        ILogger<ProfileController> logger)
    {
        _userRepository = userRepository;
        _bankAccountRepository = bankAccountRepository;
        _unitOfWork = unitOfWork;
        _fileStorageService = fileStorageService;
        _notificationService = notificationService;
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<ProfileDto>>> GetProfile()
    {
        var userId = GetUserId();
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
            return NotFound(ApiResponse<ProfileDto>.ErrorResponse("User not found"));

        var bankAccounts = await _bankAccountRepository.FindAsync(b => b.UserId == userId);
        var bankAccount = bankAccounts.FirstOrDefault();

        var dto = new ProfileDto
        {
            Id = user.Id,
            Email = user.Email,
            FirstName = user.FirstName,
            LastName = user.LastName,
            PhoneNumber = user.PhoneNumber,
            Role = user.Role.ToString(),
            ProfileImageUrl = user.ProfileImageUrl,
            CompanyName = user.CompanyName,
            GstNumber = user.GstNumber,
            ThemePreference = user.ThemePreference,
            AccountVisibility = user.AccountVisibility.ToString(),
            IsEmailVerified = user.IsEmailVerified,
            IsPhoneVerified = user.IsPhoneVerified,
            BankAccount = bankAccount != null ? MapBankAccount(bankAccount) : null
        };

        return Ok(ApiResponse<ProfileDto>.SuccessResponse(dto));
    }

    [HttpPut]
    public async Task<ActionResult<ApiResponse<ProfileDto>>> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userId = GetUserId();
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
            return NotFound(ApiResponse<ProfileDto>.ErrorResponse("User not found"));

        if (request.FirstName != null) user.FirstName = request.FirstName;
        if (request.LastName != null) user.LastName = request.LastName;
        if (request.PhoneNumber != null) user.PhoneNumber = request.PhoneNumber;
        if (request.CompanyName != null) user.CompanyName = request.CompanyName;
        if (request.GstNumber != null) user.GstNumber = request.GstNumber;

        if (request.ThemePreference != null)
        {
            if (request.ThemePreference != "light" && request.ThemePreference != "dark")
                return BadRequest(ApiResponse<ProfileDto>.ErrorResponse("Theme must be 'light' or 'dark'"));
            user.ThemePreference = request.ThemePreference;
        }

        await _userRepository.UpdateAsync(user);
        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Profile updated for user {UserId}", userId);
        return await GetProfile();
    }

    [HttpPut("visibility")]
    public async Task<ActionResult<ApiResponse<ProfileDto>>> UpdateVisibility([FromBody] UpdateVisibilityRequest request)
    {
        var userId = GetUserId();
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
            return NotFound(ApiResponse<ProfileDto>.ErrorResponse("User not found"));

        if (user.Role != UserRole.ScreenOwner)
            return BadRequest(ApiResponse<ProfileDto>.ErrorResponse("Only screen owners can change visibility"));

        if (!Enum.TryParse<ScreenVisibility>(request.Visibility, true, out var visibility))
            return BadRequest(ApiResponse<ProfileDto>.ErrorResponse("Visibility must be 'Public' or 'Private'"));

        // Block Private→Public via this endpoint — must use request workflow
        if (user.AccountVisibility == ScreenVisibility.Private && visibility == ScreenVisibility.Public)
            return BadRequest(ApiResponse<ProfileDto>.ErrorResponse("To switch to Public, please submit a visibility request for admin approval."));

        // No-op if already at target visibility
        if (user.AccountVisibility == visibility)
            return await GetProfile();

        // Guard Public→Private: check for active/upcoming bookings
        if (visibility == ScreenVisibility.Private)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var hasActiveBookings = await _context.Bookings
                .AsNoTracking()
                .AnyAsync(b => b.Screen.OwnerId == userId
                    && !b.IsDeleted
                    && (b.Status == BookingStatus.Pending || b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active)
                    && b.EndDate >= today);

            if (hasActiveBookings)
                return BadRequest(ApiResponse<ProfileDto>.ErrorResponse(
                    "Cannot switch to private while you have active or upcoming bookings. Cancel or wait for them to complete first."));
        }

        user.AccountVisibility = visibility;
        await _userRepository.UpdateAsync(user);
        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Visibility updated to {Visibility} for user {UserId}", visibility, userId);
        return await GetProfile();
    }

    [HttpPost("visibility-request")]
    public async Task<ActionResult<ApiResponse<VisibilityRequestDto>>> SubmitVisibilityRequest([FromBody] SubmitVisibilityRequestBody body)
    {
        var userId = GetUserId();
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
            return NotFound(ApiResponse<VisibilityRequestDto>.ErrorResponse("User not found"));

        if (user.Role != UserRole.ScreenOwner)
            return BadRequest(ApiResponse<VisibilityRequestDto>.ErrorResponse("Only screen owners can request visibility changes"));

        if (user.AccountVisibility == ScreenVisibility.Public)
            return BadRequest(ApiResponse<VisibilityRequestDto>.ErrorResponse("Your account is already public."));

        // Check for existing pending request
        var hasPending = await _context.VisibilityChangeRequests
            .AsNoTracking()
            .AnyAsync(r => r.UserId == userId && r.Status == VisibilityRequestStatus.Pending);

        if (hasPending)
            return BadRequest(ApiResponse<VisibilityRequestDto>.ErrorResponse("You already have a pending visibility request."));

        var request = new VisibilityChangeRequest
        {
            UserId = userId,
            RequestedVisibility = ScreenVisibility.Public,
            Status = VisibilityRequestStatus.Pending,
            RequestMessage = body.Message?.Trim(),
            RequestedAt = DateTime.UtcNow
        };

        _context.VisibilityChangeRequests.Add(request);
        await _context.SaveChangesAsync();

        // Notify all admins
        await _notificationService.CreateAdminNotificationsAsync(
            "Visibility Request",
            $"{user.FirstName} {user.LastName} has requested public marketplace access",
            NotificationType.VisibilityRequestSubmitted,
            "/admin/visibility-requests",
            request.Id,
            "VisibilityChangeRequest");

        _logger.LogInformation("Visibility request submitted by user {UserId}", userId);

        return StatusCode(201, ApiResponse<VisibilityRequestDto>.SuccessResponse(MapVisibilityRequest(request)));
    }

    [HttpGet("visibility-request")]
    public async Task<ActionResult<ApiResponse<VisibilityRequestDto?>>> GetLatestVisibilityRequest()
    {
        var userId = GetUserId();

        var latestRequest = await _context.VisibilityChangeRequests
            .AsNoTracking()
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.RequestedAt)
            .FirstOrDefaultAsync();

        if (latestRequest == null)
            return Ok(ApiResponse<VisibilityRequestDto?>.SuccessResponse(null));

        return Ok(ApiResponse<VisibilityRequestDto?>.SuccessResponse(MapVisibilityRequest(latestRequest)));
    }

    [HttpPut("bank-account")]
    public async Task<ActionResult<ApiResponse<BankAccountDto>>> UpdateBankAccount([FromBody] UpdateBankAccountRequest request)
    {
        var userId = GetUserId();
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
            return NotFound(ApiResponse<BankAccountDto>.ErrorResponse("User not found"));

        // Validate IFSC format: 4 letters + 0 + 6 alphanumeric
        if (!Regex.IsMatch(request.IfscCode, @"^[A-Z]{4}0[A-Z0-9]{6}$", RegexOptions.None, TimeSpan.FromSeconds(1)))
            return BadRequest(ApiResponse<BankAccountDto>.ErrorResponse("Invalid IFSC code format"));

        var bankAccounts = await _bankAccountRepository.FindAsync(b => b.UserId == userId);
        var bankAccount = bankAccounts.FirstOrDefault();

        if (bankAccount == null)
        {
            bankAccount = new BankAccount
            {
                UserId = userId,
                BeneficiaryName = request.BeneficiaryName,
                AccountNumber = request.AccountNumber,
                IfscCode = request.IfscCode.ToUpperInvariant(),
                BankName = request.BankName,
                IsVerified = false
            };
            await _bankAccountRepository.AddAsync(bankAccount);
        }
        else
        {
            bankAccount.BeneficiaryName = request.BeneficiaryName;
            bankAccount.AccountNumber = request.AccountNumber;
            bankAccount.IfscCode = request.IfscCode.ToUpperInvariant();
            bankAccount.BankName = request.BankName;
            bankAccount.IsVerified = false; // Reset verification on update
            await _bankAccountRepository.UpdateAsync(bankAccount);
        }

        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Bank account updated for user {UserId}", userId);
        return Ok(ApiResponse<BankAccountDto>.SuccessResponse(MapBankAccount(bankAccount)));
    }

    [HttpDelete("bank-account")]
    public async Task<ActionResult<ApiResponse<string>>> DeleteBankAccount()
    {
        var userId = GetUserId();
        var bankAccounts = await _bankAccountRepository.FindAsync(b => b.UserId == userId);
        var bankAccount = bankAccounts.FirstOrDefault();

        if (bankAccount == null)
            return NotFound(ApiResponse<string>.ErrorResponse("No bank account found"));

        await _bankAccountRepository.DeleteAsync(bankAccount.Id);
        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Bank account deleted for user {UserId}", userId);
        return Ok(ApiResponse<string>.SuccessResponse("Bank account removed"));
    }

    [HttpPost("change-password")]
    public async Task<ActionResult<ApiResponse<string>>> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = GetUserId();
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
            return NotFound(ApiResponse<string>.ErrorResponse("User not found"));

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            return BadRequest(ApiResponse<string>.ErrorResponse("Current password is incorrect"));

        if (request.NewPassword.Length < 8)
            return BadRequest(ApiResponse<string>.ErrorResponse("New password must be at least 8 characters"));

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _userRepository.UpdateAsync(user);
        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Password changed for user {UserId}", userId);
        return Ok(ApiResponse<string>.SuccessResponse("Password changed successfully"));
    }

    [HttpPost("profile-image")]
    [RequestSizeLimit(5_000_000)] // 5MB limit
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<ApiResponse<ProfileDto>>> UploadProfileImage([FromForm] IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse<ProfileDto>.ErrorResponse("No file uploaded"));

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType))
            return BadRequest(ApiResponse<ProfileDto>.ErrorResponse("Only JPEG, PNG, and WebP images are allowed"));

        var userId = GetUserId();
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
            return NotFound(ApiResponse<ProfileDto>.ErrorResponse("User not found"));

        var fileName = $"profiles/{userId}/{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
        using var stream = file.OpenReadStream();
        var url = await _fileStorageService.UploadFileAsync(stream, fileName, file.ContentType);

        user.ProfileImageUrl = url;
        await _userRepository.UpdateAsync(user);
        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Profile image updated for user {UserId}", userId);
        return await GetProfile();
    }

    private Guid GetUserId() =>
        Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    private static BankAccountDto MapBankAccount(BankAccount ba) => new()
    {
        Id = ba.Id,
        BeneficiaryName = ba.BeneficiaryName,
        AccountNumberMasked = ba.AccountNumber.Length > 4
            ? new string('*', ba.AccountNumber.Length - 4) + ba.AccountNumber[^4..]
            : "****",
        IfscCode = ba.IfscCode,
        BankName = ba.BankName,
        IsVerified = ba.IsVerified
    };

    private static VisibilityRequestDto MapVisibilityRequest(VisibilityChangeRequest r) => new()
    {
        Id = r.Id,
        RequestedVisibility = r.RequestedVisibility.ToString(),
        Status = r.Status.ToString(),
        RequestMessage = r.RequestMessage,
        RequestedAt = r.RequestedAt,
        AdminReviewedAt = r.AdminReviewedAt,
        RejectionReason = r.RejectionReason,
    };
}
