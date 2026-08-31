using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CCMS.Infrastructure.Data;

/// <summary>
/// One-time data repair for a period where R2:PublicUrlBase was misconfigured to
/// pub-4f22ea89a2e684c242ace359b5706b03.r2.dev — a bucket with public access
/// disabled — instead of the correct pub-c37d8aeca6e04cb7bb13a43d90d86fd6.r2.dev
/// (the bucket nginx's /media/ proxy has always pointed at). Every upload made
/// during that window has the wrong host baked into its stored URL; the objects
/// themselves were written to the correct bucket regardless, since writes go
/// through authenticated S3 credentials independent of PublicUrlBase. A plain
/// host swap is therefore sufficient to repair every affected row.
///
/// Safe to run on every startup: matches only rows still on the wrong host, so
/// it is a no-op once everything has been fixed once.
/// </summary>
public static class R2UrlFixup
{
    private const string WrongHost = "https://pub-4f22ea89a2e684c242ace359b5706b03.r2.dev";
    private const string CorrectHost = "https://pub-c37d8aeca6e04cb7bb13a43d90d86fd6.r2.dev";

    public static async Task FixBrokenPublicUrlsAsync(ApplicationDbContext context, ILogger logger)
    {
        var fixedCounts = new Dictionary<string, int>
        {
            ["OwnerContent.FileUrl"] = await context.OwnerContents
                .Where(x => x.FileUrl.StartsWith(WrongHost))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.FileUrl, x => x.FileUrl.Replace(WrongHost, CorrectHost))),

            ["Creative.FileUrl"] = await context.Creatives
                .Where(x => x.FileUrl.StartsWith(WrongHost))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.FileUrl, x => x.FileUrl.Replace(WrongHost, CorrectHost))),

            ["Creative.ThumbnailUrl"] = await context.Creatives
                .Where(x => x.ThumbnailUrl != null && x.ThumbnailUrl.StartsWith(WrongHost))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.ThumbnailUrl, x => x.ThumbnailUrl!.Replace(WrongHost, CorrectHost))),

            ["MediaAsset.FileUrl"] = await context.MediaAssets
                .Where(x => x.FileUrl.StartsWith(WrongHost))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.FileUrl, x => x.FileUrl.Replace(WrongHost, CorrectHost))),

            ["MediaAsset.ThumbnailUrl"] = await context.MediaAssets
                .Where(x => x.ThumbnailUrl != null && x.ThumbnailUrl.StartsWith(WrongHost))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.ThumbnailUrl, x => x.ThumbnailUrl!.Replace(WrongHost, CorrectHost))),

            ["ScreenImage.ImageUrl"] = await context.ScreenImages
                .Where(x => x.ImageUrl.StartsWith(WrongHost))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.ImageUrl, x => x.ImageUrl.Replace(WrongHost, CorrectHost))),

            ["ScreenVerification.VideoUrl"] = await context.ScreenVerifications
                .Where(x => x.VideoUrl != null && x.VideoUrl.StartsWith(WrongHost))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.VideoUrl, x => x.VideoUrl!.Replace(WrongHost, CorrectHost))),

            ["User.ProfileImageUrl"] = await context.Users
                .Where(x => x.ProfileImageUrl != null && x.ProfileImageUrl.StartsWith(WrongHost))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.ProfileImageUrl, x => x.ProfileImageUrl!.Replace(WrongHost, CorrectHost))),

            ["Screen.DefaultVideoUrl"] = await context.Screens
                .Where(x => x.DefaultVideoUrl != null && x.DefaultVideoUrl.StartsWith(WrongHost))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.DefaultVideoUrl, x => x.DefaultVideoUrl!.Replace(WrongHost, CorrectHost))),
        };

        var total = fixedCounts.Values.Sum();
        if (total > 0)
        {
            var breakdown = string.Join(", ", fixedCounts.Where(kv => kv.Value > 0).Select(kv => $"{kv.Key}={kv.Value}"));
            logger.LogWarning(
                "R2UrlFixup: corrected {Total} stored URL(s) pointing at the misconfigured R2 host ({WrongHost} -> {CorrectHost}): {Breakdown}",
                total, WrongHost, CorrectHost, breakdown);
        }
    }
}
