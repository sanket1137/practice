using AutoMapper;
using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Domain.Enums;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Campaigns;

namespace CCMS.Application.Features.Campaigns.Queries;

/// <summary>
/// Handler for GetCampaignsPagedQuery - returns paginated list of campaigns.
/// </summary>
public class GetCampaignsPagedQueryHandler : IRequestHandler<GetCampaignsPagedQuery, PagedResult<CampaignDto>>
{
    private readonly IRepository<Campaign> _campaignRepository;
    private readonly IMapper _mapper;

    public GetCampaignsPagedQueryHandler(IRepository<Campaign> campaignRepository, IMapper mapper)
    {
        _campaignRepository = campaignRepository;
        _mapper = mapper;
    }

    public async Task<PagedResult<CampaignDto>> Handle(GetCampaignsPagedQuery request, CancellationToken cancellationToken)
    {
        // Ensure valid pagination parameters
        var pageNumber = Math.Max(1, request.PageNumber);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        
        // Get campaigns filtered by user or all for admin
        var campaigns = request.UserId == Guid.Empty
            ? await _campaignRepository.GetAllAsync(cancellationToken)
            : await _campaignRepository.FindAsync(c => c.AdvertiserId == request.UserId, cancellationToken);

        var campaignsList = campaigns.ToList();
        
        // Apply status filter
        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            if (Enum.TryParse<CampaignStatus>(request.Status, true, out var status))
            {
                campaignsList = campaignsList.Where(c => c.Status == status).ToList();
            }
        }
        
        // Apply search filter
        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchLower = request.SearchTerm.ToLowerInvariant();
            campaignsList = campaignsList.Where(c => 
                c.Name != null && c.Name.ToLowerInvariant().Contains(searchLower)).ToList();
        }

        // Apply sorting
        IEnumerable<Campaign> sortedCampaigns = request.SortBy?.ToLowerInvariant() switch
        {
            "name" => request.SortDirection?.ToLowerInvariant() == "asc" 
                ? campaignsList.OrderBy(c => c.Name) 
                : campaignsList.OrderByDescending(c => c.Name),
            "startdate" => request.SortDirection?.ToLowerInvariant() == "asc" 
                ? campaignsList.OrderBy(c => c.StartDate) 
                : campaignsList.OrderByDescending(c => c.StartDate),
            "enddate" => request.SortDirection?.ToLowerInvariant() == "asc" 
                ? campaignsList.OrderBy(c => c.EndDate) 
                : campaignsList.OrderByDescending(c => c.EndDate),
            _ => request.SortDirection?.ToLowerInvariant() == "asc" 
                ? campaignsList.OrderBy(c => c.CreatedAt) 
                : campaignsList.OrderByDescending(c => c.CreatedAt)
        };

        var sortedList = sortedCampaigns.ToList();
        var totalCount = sortedList.Count;

        // Apply pagination
        var pagedCampaigns = sortedList
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var campaignDtos = _mapper.Map<List<CampaignDto>>(pagedCampaigns);

        return new PagedResult<CampaignDto>
        {
            Items = campaignDtos,
            TotalCount = totalCount,
            PageNumber = pageNumber,
            PageSize = pageSize
        };
    }
}
