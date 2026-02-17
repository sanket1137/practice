namespace CCMS.Application.Helpers;

/// <summary>
/// Converts raw R2 public URLs to same-origin proxy URLs for browser consumption.
/// 
/// Architecture:
///   - Stored URLs in database are raw R2 URLs (e.g., https://pub-xxx.r2.dev/uploads/...)
///   - The Raspberry Pi player receives raw R2 URLs and downloads directly (no CORS issue)
///   - The browser frontend receives proxy URLs (/media/uploads/...) that nginx serves
///     from the same origin, eliminating CORS entirely
/// 
/// The nginx /media/ location block proxies requests to R2:
///   /media/uploads/Screens/xxx/file.mp4 → https://pub-xxx.r2.dev/uploads/Screens/xxx/file.mp4
/// </summary>
public static class MediaUrlHelper
{
    /// <summary>
    /// Converts a raw R2 URL to a same-origin proxy path served by nginx.
    /// Returns null for null/empty input. Returns the URL unchanged if it's not an R2 URL.
    /// </summary>
    /// <param name="rawUrl">The stored R2 URL (e.g., "https://pub-xxx.r2.dev/uploads/file.mp4")</param>
    /// <param name="r2PublicUrlBase">The R2 public URL base from configuration (e.g., "https://pub-xxx.r2.dev")</param>
    /// <returns>A same-origin proxy path (e.g., "/media/uploads/file.mp4") or null</returns>
    public static string? ToProxyUrl(string? rawUrl, string r2PublicUrlBase)
    {
        if (string.IsNullOrEmpty(rawUrl))
            return null;

        // Only rewrite URLs that match the configured R2 public base
        if (rawUrl.StartsWith(r2PublicUrlBase, StringComparison.OrdinalIgnoreCase))
        {
            // https://pub-xxx.r2.dev/uploads/file.mp4 → /media/uploads/file.mp4
            var relativePath = rawUrl[r2PublicUrlBase.Length..]; // "/uploads/file.mp4"
            return $"/media{relativePath}";
        }

        // Not an R2 URL — return as-is (could be an external URL or already proxied)
        return rawUrl;
    }
}
