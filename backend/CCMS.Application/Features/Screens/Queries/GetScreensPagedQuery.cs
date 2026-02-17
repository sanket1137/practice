using MediatR;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Features.Screens.Queries;

/// <summary>
/// Query to get screens with server-side pagination support.
/// </summary>
public class GetScreensPagedQuery : IRequest<PagedResult<ScreenDto>>
{
    /// <summary>
    /// Filter screens by owner (for screen owners viewing their own screens)
    /// </summary>
    public Guid? OwnerId { get; set; }
    
    /// <summary>
    /// Page number (1-based). Defaults to 1.
    /// </summary>
    public int PageNumber { get; set; } = 1;
    
    /// <summary>
    /// Number of items per page. Defaults to 10.
    /// </summary>
    public int PageSize { get; set; } = 10;
    
    /// <summary>
    /// Optional search term to filter screens by name or location
    /// </summary>
    public string? SearchTerm { get; set; }
    
    /// <summary>
    /// Optional filter by screen status (Online, Offline, Maintenance)
    /// </summary>
    public string? Status { get; set; }
    
    /// <summary>
    /// Sort by field (Name, Location, CreatedAt). Defaults to CreatedAt.
    /// </summary>
    public string SortBy { get; set; } = "CreatedAt";
    
    /// <summary>
    /// Sort direction (asc or desc). Defaults to desc.
    /// </summary>
    public string SortDirection { get; set; } = "desc";
}
