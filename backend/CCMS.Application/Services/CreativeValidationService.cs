using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Creatives;

namespace CCMS.Application.Services;

public class CreativeValidationService
{
    private readonly IRepository<Creative> _creativeRepo;
    private readonly IRepository<Screen> _screenRepo;

    public CreativeValidationService(
        IRepository<Creative> creativeRepo,
        IRepository<Screen> screenRepo)
    {
        _creativeRepo = creativeRepo;
        _screenRepo = screenRepo;
    }

    /// <summary>
    /// Validate if a creative is compatible with a screen
    /// </summary>
    public async Task<CreativeValidationDto> ValidateCreativeForScreen(
        Guid creativeId, 
        Guid screenId,
        CancellationToken cancellationToken = default)
    {
        var creative = await _creativeRepo.GetByIdAsync(creativeId, cancellationToken);
        var screen = await _screenRepo.GetByIdAsync(screenId, cancellationToken);

        if (creative == null)
            throw new KeyNotFoundException("Creative not found");

        if (screen == null)
            throw new KeyNotFoundException("Screen not found");

        var result = new CreativeValidationDto
        {
            Requirements = new CreativeRequirementsDto
            {
                SupportedSizes = new List<DimensionDto>
                {
                    new DimensionDto
                    {
                        Width = screen.ResolutionWidth,
                        Height = screen.ResolutionHeight
                    }
                },
                MaxDuration = (screen.TimeFrameMinutes * 60) / screen.SlotsPerFrame
            }
        };

        var errors = new List<string>();

        // Check dimension match
        if (creative.Width != screen.ResolutionWidth || creative.Height != screen.ResolutionHeight)
        {
            errors.Add($"Creative dimensions ({creative.Width}×{creative.Height}) do not match screen requirements ({screen.ResolutionWidth}×{screen.ResolutionHeight})");
        }

        // Check duration
        var maxDuration = (screen.TimeFrameMinutes * 60) / screen.SlotsPerFrame;
        if (creative.Duration > maxDuration)
        {
            errors.Add($"Creative duration ({creative.Duration}s) exceeds maximum allowed ({maxDuration}s)");
        }

        result.IsCompatible = errors.Count == 0;
        result.Errors = errors;

        return result;
    }

    /// <summary>
    /// Get all compatible creatives for a campaign and screen
    /// </summary>
    public async Task<List<Creative>> GetCompatibleCreatives(
        Guid campaignId,
        Guid screenId,
        CancellationToken cancellationToken = default)
    {
        var screen = await _screenRepo.GetByIdAsync(screenId, cancellationToken);
        if (screen == null)
            return new List<Creative>();

        var campaignCreatives = await _creativeRepo
            .FindAsync(c => c.CampaignId == campaignId, cancellationToken);

        var maxDuration = (screen.TimeFrameMinutes * 60) / screen.SlotsPerFrame;

        var compatibleCreatives = campaignCreatives
            .Where(c => 
                c.Width == screen.ResolutionWidth &&
                c.Height == screen.ResolutionHeight &&
                c.Duration <= maxDuration)
            .ToList();

        return compatibleCreatives;
    }
}
