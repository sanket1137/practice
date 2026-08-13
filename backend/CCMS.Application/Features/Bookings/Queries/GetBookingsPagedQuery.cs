using MediatR;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Bookings;

namespace CCMS.Application.Features.Bookings.Queries;

/// <summary>
/// Query to get bookings with server-side pagination support.
/// </summary>
public class GetBookingsPagedQuery : IRequest<PagedResult<BookingDto>>
{
    /// <summary>
    /// Filter by advertiser (user) ID
    /// </summary>
    public Guid? UserId { get; set; }
    
    /// <summary>
    /// Filter by screen owner ID
    /// </summary>
    public Guid? ScreenOwnerId { get; set; }
    
    /// <summary>
    /// Filter by campaign ID
    /// </summary>
    public Guid? CampaignId { get; set; }
    
    /// <summary>
    /// Filter by specific screen
    /// </summary>
    public Guid? ScreenId { get; set; }
    
    /// <summary>
    /// Page number (1-based). Defaults to 1.
    /// </summary>
    public int PageNumber { get; set; } = 1;
    
    /// <summary>
    /// Number of items per page. Defaults to 10.
    /// </summary>
    public int PageSize { get; set; } = 10;
    
    /// <summary>
    /// Optional filter by booking status (Pending, Approved, Rejected, Active, Completed)
    /// </summary>
    public string? Status { get; set; }
    
    /// <summary>
    /// Optional search term to filter by campaign name or screen name
    /// </summary>
    public string? SearchTerm { get; set; }
    
    /// <summary>
    /// Sort by field (CreatedAt, StartDate, EndDate, Status). Defaults to CreatedAt.
    /// </summary>
    public string SortBy { get; set; } = "CreatedAt";
    
    /// <summary>
    /// Sort direction (asc or desc). Defaults to desc.
    /// </summary>
    public string SortDirection { get; set; } = "desc";
}
