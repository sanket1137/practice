using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CCMS.Application.Interfaces;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Profile;
using System.Security.Claims;
using Asp.Versioning;

namespace CCMS.Api.Controllers;

[Authorize(Roles = "Admin")]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/admin/visibility-requests")]
public class AdminVisibilityController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly INotificationService _notificationService;
    private readonly ILogger<AdminVisibilityController> _logger;

    public AdminVisibilityController(
        ApplicationDbContext context,
        INotificationService notificationService,
        ILogger<AdminVisibilityController> logger)
    {
        _context = context;
        _notificationService = notificationService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<VisibilityRequestDetailDto>>>> GetAll(
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = _context.VisibilityChangeRequests
            .AsNoTracking()
            .Include(r => r.User)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<VisibilityRequestStatus>(status, true, out var statusFilter))
        {
            query = query.Where(r => r.Status == statusFilter);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLowerInvariant();
            query = query.Where(r =>
                r.User.FirstName.ToLower().Contains(searchLower) ||
                r.User.LastName.ToLower().Contains(searchLower) ||
                r.User.Email.ToLower().Contains(searchLower));
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(r => r.RequestedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new VisibilityRequestDetailDto
            {
                Id = r.Id,
                UserId = r.UserId,
                UserName = r.User.FirstName + " " + r.User.LastName,
                UserEmail = r.User.Email,
                ScreensCount = _context.Screens.Count(s => s.OwnerId == r.UserId && !s.IsDeleted),
                RequestedVisibility = r.RequestedVisibility.ToString(),
                Status = r.Status.ToString(),
                RequestMessage = r.RequestMessage,
                RequestedAt = r.RequestedAt,
                AdminReviewedAt = r.AdminReviewedAt,
                RejectionReason = r.RejectionReason,
            })
            .ToListAsync();

        var result = new PagedResult<VisibilityRequestDetailDto>
        {
            Items = items,
            TotalCount = totalCount,
            PageNumber = page,
            PageSize = pageSize
        };

        return Ok(ApiResponse<PagedResult<VisibilityRequestDetailDto>>.SuccessResponse(result));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<VisibilityRequestDetailDto>>> GetById(Guid id)
    {
        var request = await _context.VisibilityChangeRequests
            .AsNoTracking()
            .Include(r => r.User)
            .Include(r => r.AdminReviewedByUser)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (request == null)
            return NotFound(ApiResponse<VisibilityRequestDetailDto>.ErrorResponse("Request not found"));

        var screensCount = await _context.Screens
            .AsNoTracking()
            .CountAsync(s => s.OwnerId == request.UserId && !s.IsDeleted);

        var dto = new VisibilityRequestDetailDto
        {
            Id = request.Id,
            UserId = request.UserId,
            UserName = $"{request.User.FirstName} {request.User.LastName}",
            UserEmail = request.User.Email,
            ScreensCount = screensCount,
            RequestedVisibility = request.RequestedVisibility.ToString(),
            Status = request.Status.ToString(),
            RequestMessage = request.RequestMessage,
            RequestedAt = request.RequestedAt,
            AdminReviewedAt = request.AdminReviewedAt,
            RejectionReason = request.RejectionReason,
            AdminReviewedByName = request.AdminReviewedByUser != null
                ? $"{request.AdminReviewedByUser.FirstName} {request.AdminReviewedByUser.LastName}"
                : null,
        };

        return Ok(ApiResponse<VisibilityRequestDetailDto>.SuccessResponse(dto));
    }

    [HttpPost("{id}/approve")]
    public async Task<ActionResult<ApiResponse<VisibilityRequestDto>>> Approve(Guid id)
    {
        var request = await _context.VisibilityChangeRequests
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (request == null)
            return NotFound(ApiResponse<VisibilityRequestDto>.ErrorResponse("Request not found"));

        if (request.Status != VisibilityRequestStatus.Pending)
            return BadRequest(ApiResponse<VisibilityRequestDto>.ErrorResponse("This request has already been processed."));

        var adminUserId = GetUserId();

        // Update request
        request.Status = VisibilityRequestStatus.Approved;
        request.AdminReviewedByUserId = adminUserId;
        request.AdminReviewedAt = DateTime.UtcNow;

        // Update user visibility
        request.User.AccountVisibility = ScreenVisibility.Public;

        await _context.SaveChangesAsync();

        // Notify user
        await _notificationService.CreateNotificationAsync(
            request.UserId,
            "Public Access Approved",
            "Your account is now visible on the marketplace!",
            NotificationType.VisibilityRequestApproved,
            "/profile",
            request.Id,
            "VisibilityChangeRequest");

        _logger.LogInformation("Admin {AdminId} approved visibility request {RequestId} for user {UserId}",
            adminUserId, id, request.UserId);

        return Ok(ApiResponse<VisibilityRequestDto>.SuccessResponse(new VisibilityRequestDto
        {
            Id = request.Id,
            Status = request.Status.ToString(),
            RequestedVisibility = request.RequestedVisibility.ToString(),
            RequestMessage = request.RequestMessage,
            RequestedAt = request.RequestedAt,
            AdminReviewedAt = request.AdminReviewedAt,
        }));
    }

    [HttpPost("{id}/reject")]
    public async Task<ActionResult<ApiResponse<VisibilityRequestDto>>> Reject(Guid id, [FromBody] RejectVisibilityRequestBody body)
    {
        if (string.IsNullOrWhiteSpace(body.Reason))
            return BadRequest(ApiResponse<VisibilityRequestDto>.ErrorResponse("Rejection reason is required."));

        var request = await _context.VisibilityChangeRequests
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (request == null)
            return NotFound(ApiResponse<VisibilityRequestDto>.ErrorResponse("Request not found"));

        if (request.Status != VisibilityRequestStatus.Pending)
            return BadRequest(ApiResponse<VisibilityRequestDto>.ErrorResponse("This request has already been processed."));

        var adminUserId = GetUserId();

        // Update request
        request.Status = VisibilityRequestStatus.Rejected;
        request.AdminReviewedByUserId = adminUserId;
        request.AdminReviewedAt = DateTime.UtcNow;
        request.RejectionReason = body.Reason.Trim();

        // User stays Private — no visibility change
        await _context.SaveChangesAsync();

        // Notify user
        await _notificationService.CreateNotificationAsync(
            request.UserId,
            "Public Access Rejected",
            $"Your visibility request was rejected. Reason: {request.RejectionReason}",
            NotificationType.VisibilityRequestRejected,
            "/profile",
            request.Id,
            "VisibilityChangeRequest");

        _logger.LogInformation("Admin {AdminId} rejected visibility request {RequestId} for user {UserId}. Reason: {Reason}",
            adminUserId, id, request.UserId, request.RejectionReason);

        return Ok(ApiResponse<VisibilityRequestDto>.SuccessResponse(new VisibilityRequestDto
        {
            Id = request.Id,
            Status = request.Status.ToString(),
            RequestedVisibility = request.RequestedVisibility.ToString(),
            RequestMessage = request.RequestMessage,
            RequestedAt = request.RequestedAt,
            AdminReviewedAt = request.AdminReviewedAt,
            RejectionReason = request.RejectionReason,
        }));
    }

    private Guid GetUserId() =>
        Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
}
