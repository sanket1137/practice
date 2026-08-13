using System.IO;
using System.Net.Http;

namespace PixelSpot.Player.Services;

/// <summary>
/// Downloads content from Cloudflare R2 CDN to a local cache directory.
/// Skips files that are already cached.
/// </summary>
public class ContentDownloader
{
    private static readonly string CachePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "PixelSpot", "Player", "cache"
    );

    private readonly HttpClient _http = new();

    public ContentDownloader()
    {
        Directory.CreateDirectory(CachePath);
    }

    /// <summary>Downloads the given URL to cache. Returns the local file path.</summary>
    public async Task<string> EnsureCachedAsync(string contentId, string url, CancellationToken ct = default)
    {
        var uri = new Uri(url);
        var ext = Path.GetExtension(uri.LocalPath).ToLowerInvariant();
        if (string.IsNullOrEmpty(ext)) ext = ".mp4";
        var localPath = Path.Combine(CachePath, $"{contentId}{ext}");

        if (File.Exists(localPath))
            return localPath;

        var tmpPath = localPath + ".tmp";
        try
        {
            using var resp = await _http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
            resp.EnsureSuccessStatusCode();

            await using var fs = new FileStream(tmpPath, FileMode.Create, FileAccess.Write, FileShare.None);
            await resp.Content.CopyToAsync(fs, ct);
        }
        catch
        {
            if (File.Exists(tmpPath)) File.Delete(tmpPath);
            throw;
        }

        File.Move(tmpPath, localPath, overwrite: true);
        return localPath;
    }

    /// <summary>Removes cached files not present in the new manifest.</summary>
    public void PruneCache(IEnumerable<string> activeContentIds)
    {
        var activeSet = new HashSet<string>(activeContentIds, StringComparer.OrdinalIgnoreCase);
        foreach (var file in Directory.GetFiles(CachePath))
        {
            var id = Path.GetFileNameWithoutExtension(file);
            if (!activeSet.Contains(id))
            {
                try { File.Delete(file); } catch { /* ignore — file may be in use */ }
            }
        }
    }

    public string GetLocalPath(string contentId, string url)
    {
        var uri = new Uri(url);
        var ext = Path.GetExtension(uri.LocalPath).ToLowerInvariant();
        if (string.IsNullOrEmpty(ext)) ext = ".mp4";
        return Path.Combine(CachePath, $"{contentId}{ext}");
    }
}
