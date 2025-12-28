using CCMS.Shared.Common;
using MediatR;
using CCMS.Domain.Interfaces;
using CCMS.Domain.Entities;

namespace CCMS.Application.Features.Campaigns.Queries;

public class GetCampaignScreensStatsQuery : IRequest<CampaignScreensStatsDto>
{
    public Guid CampaignId { get; set; }
}

public class GetCampaignScreensStatsQueryHandler : IRequestHandler<GetCampaignScreensStatsQuery, CampaignScreensStatsDto>
{
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Impression> _impressionRepository;

    public GetCampaignScreensStatsQueryHandler(
        IRepository<Booking> bookingRepository,
        IRepository<Impression> impressionRepository)
    {
        _bookingRepository = bookingRepository;
        _impressionRepository = impressionRepository;
    }

    public async Task<CampaignScreensStatsDto> Handle(GetCampaignScreensStatsQuery request, CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);

        // Get all bookings for this campaign
        var allBookings = await _bookingRepository.GetAllAsync();
        var bookings = allBookings.Where(b => b.CampaignId == request.CampaignId).ToList();

        // Get all impressions
        var allImpressions = await _impressionRepository.GetAllAsync();
        var campaignImpressions = allImpressions
            .Where(i => i.CampaignId == request.CampaignId 
                && i.CreatedAt >= today 
                && i.CreatedAt < tomorrow)
            .ToList();

        var screenStats = new List<ScreenStatsDto>();
        var totalPlays = 0;
        var activeScreens = 0;

        foreach (var booking in bookings)
        {
            // Count impressions for this screen today
            var playsToday = campaignImpressions.Count(i => i.ScreenId == booking.ScreenId);
            totalPlays += playsToday;

            if (playsToday > 0)
                activeScreens++;

            var lastPlay = allImpressions
                .Where(i => i.CampaignId == request.CampaignId && i.ScreenId == booking.ScreenId)
                .OrderByDescending(i => i.CreatedAt)
                .FirstOrDefault();

            screenStats.Add(new ScreenStatsDto
            {
                ScreenId = booking.ScreenId.ToString(),
                ScreenName = booking.Screen?.Name ?? "Unknown",
                Status = playsToday > 0 ? "online" : "offline",
                PlaysToday = playsToday,
                LastPlayTimestamp = lastPlay?.CreatedAt.ToString("O")
            });
        }

        return new CampaignScreensStatsDto
        {
            Screens = screenStats,
            TotalPlays = totalPlays,
            ActiveScreens = activeScreens
        };
    }
}

public class CampaignScreensStatsDto
{
    public List<ScreenStatsDto> Screens { get; set; } = new();
    public int TotalPlays { get; set; }
    public int ActiveScreens { get; set; }
}

public class ScreenStatsDto
{
    public string ScreenId { get; set; } = string.Empty;
    public string ScreenName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int PlaysToday { get; set; }
    public string? LastPlayTimestamp { get; set; }
}
