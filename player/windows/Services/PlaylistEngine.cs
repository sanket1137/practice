namespace PixelSpot.Player.Services;

public record PlaylistItem(
    string ContentId,
    string LocalPath,
    bool IsVideo,
    int DurationSeconds,
    int Order
);

/// <summary>
/// Manages the ordered playlist and provides the next item to play.
/// Thread-safe — may be updated while playback is in progress.
/// </summary>
public class PlaylistEngine
{
    private readonly ContentDownloader _downloader;
    private List<PlaylistItem> _items = [];
    private int _currentIndex = 0;
    private readonly object _lock = new();

    public string? CurrentContentId
    {
        get
        {
            lock (_lock)
            {
                if (_items.Count == 0 || _currentIndex >= _items.Count) return null;
                return _items[_currentIndex].ContentId;
            }
        }
    }

    public PlaylistEngine(ContentDownloader downloader)
    {
        _downloader = downloader;
    }

    public async Task SyncFromManifestAsync(ManifestItem[] manifest, CancellationToken ct = default)
    {
        var sorted = manifest.OrderBy(m => m.Order).ToArray();
        var newItems = new List<PlaylistItem>();

        foreach (var item in sorted)
        {
            ct.ThrowIfCancellationRequested();
            var isVideo = item.ContentType.StartsWith("video", StringComparison.OrdinalIgnoreCase)
                       || item.Url.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase);

            string localPath;
            try
            {
                localPath = await _downloader.EnsureCachedAsync(item.ContentId, item.Url, ct);
            }
            catch
            {
                // If download fails, skip this item
                continue;
            }

            newItems.Add(new PlaylistItem(item.ContentId, localPath, isVideo, item.DurationSeconds, item.Order));
        }

        lock (_lock)
        {
            _items = newItems;
            _currentIndex = 0;
        }

        // Prune stale cached files
        _downloader.PruneCache(newItems.Select(i => i.ContentId));
    }

    public PlaylistItem? GetNext()
    {
        lock (_lock)
        {
            if (_items.Count == 0) return null;
            var item = _items[_currentIndex];
            _currentIndex = (_currentIndex + 1) % _items.Count;
            return item;
        }
    }
}
