using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Creatives;

namespace CCMS.Application.Services;

public class CreativeValidationService
{
    private readonly IRepository<Creative> _creativeRepo;
    private readonly IRepository<Screen> _screenRepo;

    // Minimum acceptable native resolution. Anything below this is treated as
    // unusable regardless of FitMode (the player cannot upscale beyond this
    // without unacceptable artifacts).
    private const int MinAcceptableShortSide = 240;

    // Aspect-ratio delta beyond which the player should default to SmartAdaptive
    // even if the resolution mismatch is otherwise minor. 5% = comfortable.
    private const double AspectWarningThreshold = 0.05;

    public CreativeValidationService(
        IRepository<Creative> creativeRepo,
        IRepository<Screen> screenRepo)
    {
        _creativeRepo = creativeRepo;
        _screenRepo = screenRepo;
    }

    /// <summary>
    /// Phase 1 adaptive validation. Only hard-fails on conditions the player
    /// cannot work around (duration overflow, missing media, extremely low
    /// resolution). Dimension and aspect-ratio mismatches surface as
    /// non-blocking warnings with a SuggestedFitMode for the UI to apply.
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

        var maxDuration = (screen.TimeFrameMinutes * 60) / Math.Max(1, screen.SlotsPerFrame);

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
                MaxDuration = maxDuration
            }
        };

        // ─── HARD ERRORS (block the booking) ────────────────────────────
        if (string.IsNullOrWhiteSpace(creative.FileUrl))
        {
            result.Errors.Add("Creative file is missing or corrupted");
        }

        if (creative.Duration > maxDuration)
        {
            result.Errors.Add(
                $"Creative duration ({creative.Duration}s) exceeds the slot length of {maxDuration}s on this screen");
        }

        var shortSide = Math.Min(creative.Width, creative.Height);
        if (shortSide > 0 && shortSide < MinAcceptableShortSide)
        {
            result.Errors.Add(
                $"Creative resolution ({creative.Width}×{creative.Height}) is below the minimum playable resolution (short side ≥ {MinAcceptableShortSide}px)");
        }

        // ─── SOFT WARNINGS (player resolves via FitMode) ────────────────
        var dimensionMismatch =
            creative.Width != screen.ResolutionWidth ||
            creative.Height != screen.ResolutionHeight;

        if (dimensionMismatch && creative.Width > 0 && creative.Height > 0)
        {
            var creativeAspect = (double)creative.Width / creative.Height;
            var screenAspect = (double)screen.ResolutionWidth / Math.Max(1, screen.ResolutionHeight);
            var aspectDelta = Math.Abs(creativeAspect - screenAspect) / screenAspect;

            if (aspectDelta > AspectWarningThreshold)
            {
                result.Warnings.Add(
                    $"Creative aspect ratio differs from the screen ({creative.Width}×{creative.Height} vs {screen.ResolutionWidth}×{screen.ResolutionHeight}). The player will adapt using the selected fit mode.");
                result.SuggestedFitMode = CreativeFitMode.SmartAdaptive;
            }
            else
            {
                result.Warnings.Add(
                    $"Creative resolution differs from the screen ({creative.Width}×{creative.Height} vs {screen.ResolutionWidth}×{screen.ResolutionHeight}). The player will scale it to fit.");
                result.SuggestedFitMode ??= CreativeFitMode.Fit;
            }
        }

        result.IsCompatible = result.Errors.Count == 0;
        return result;
    }

    /// <summary>
    /// Returns all creatives for the campaign that can be played on the screen
    /// (i.e. have no HARD errors). Aspect / dimension mismatches no longer
    /// exclude a creative from this list — they are surfaced as warnings.
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

        var maxDuration = (screen.TimeFrameMinutes * 60) / Math.Max(1, screen.SlotsPerFrame);

        return campaignCreatives
            .Where(c =>
                !string.IsNullOrWhiteSpace(c.FileUrl) &&
                c.Duration <= maxDuration &&
                Math.Min(c.Width, c.Height) >= MinAcceptableShortSide)
            .ToList();
    }
}
