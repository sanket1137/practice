using MediatR;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Campaigns;

namespace CCMS.Application.Features.Campaigns.Queries;

/// <summary>
/// Query to get campaigns with server-side pagination support.
/// </summary>
public class GetCampaignsPagedQuery : IRequest<PagedResult<CampaignDto>>
{
    /// <summary>
    /// Filter by advertiser ID. If Guid.Empty, return all campaigns (admin).
    /// </summary>
    public Guid UserId { get; set; }
    
    /// <summary>
    /// Page number (1-based). Defaults to 1.
    /// </summary>
    public int PageNumber { get; set; } = 1;
    
    /// <summary>
    /// Number of items per page. Defaults to 10.
    /// </summary>
    public int PageSize { get; set; } = 10;
    
    /// <summary>
    /// Optional search term to filter by campaign name
    /// </summary>
    public string? SearchTerm { get; set; }
    
    /// <summary>
    /// Optional filter by campaign status (Draft, Active, Paused, Completed)
    /// </summary>
    public string? Status { get; set; }
    
    /// <summary>
    /// Sort by field (Name, CreatedAt, StartDate, EndDate). Defaults to CreatedAt.
    /// </summary>
    public string SortBy { get; set; } = "CreatedAt";
    
    /// <summary>
    /// Sort direction (asc or desc). Defaults to desc.
    /// </summary>
    public string SortDirection { get; set; } = "desc";
}
