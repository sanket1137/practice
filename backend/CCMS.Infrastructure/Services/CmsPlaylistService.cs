using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using CCMS.Shared.DTOs.Cms;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CCMS.Infrastructure.Services;

public class CmsPlaylistService : ICmsPlaylistService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<CmsPlaylistService> _logger;

    public CmsPlaylistService(ApplicationDbContext context, ILogger<CmsPlaylistService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<CmsPlaylistDto>> ListForScreenAsync(Guid ownerId, Guid screenId, CancellationToken ct = default)
    {
        await EnsureScreenOwnedAsync(ownerId, screenId, ct);

        var playlists = await _context.Playlists
            .AsNoTracking()
            .Where(p => p.ScreenId == screenId)
            .OrderBy(p => p.Name)
            .Include(p => p.Items.OrderBy(i => i.Order))
                .ThenInclude(i => i.MediaAsset)
            .ToListAsync(ct);

        var defaultId = await _context.Screens
            .AsNoTracking()
            .Where(s => s.Id == screenId)
            .Select(s => s.DefaultPlaylistId)
            .FirstOrDefaultAsync(ct);

        return playlists.Select(p => ToDto(p, defaultId == p.Id)).ToList();
    }

    public async Task<CmsPlaylistDto> GetAsync(Guid ownerId, Guid playlistId, CancellationToken ct = default)
    {
        var playlist = await LoadOwnedPlaylistAsync(ownerId, playlistId, tracked: false, ct);
        var defaultId = await _context.Screens
            .AsNoTracking()
            .Where(s => s.Id == playlist.ScreenId)
            .Select(s => s.DefaultPlaylistId)
            .FirstOrDefaultAsync(ct);

        return ToDto(playlist, defaultId == playlist.Id);
    }

    public async Task<CmsPlaylistDto> CreateAsync(Guid ownerId, CreateCmsPlaylistRequest request, CancellationToken ct = default)
    {
        await EnsureScreenOwnedAsync(ownerId, request.ScreenId, ct);

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new ArgumentException("Playlist name is required");
        }
        if (!Enum.TryParse<PlaylistType>(request.PlaylistType, true, out var playlistType))
        {
            throw new ArgumentException($"Invalid playlist type: {request.PlaylistType}");
        }

        var playlist = new Playlist
        {
            ScreenId = request.ScreenId,
            Name = request.Name.Trim(),
            PlaylistType = playlistType,
            Version = 1
        };
        _context.Playlists.Add(playlist);

        // First playlist for a screen automatically becomes the default.
        var screen = await _context.Screens.FirstAsync(s => s.Id == request.ScreenId, ct);
        var hadDefault = screen.DefaultPlaylistId.HasValue;

        await _context.SaveChangesAsync(ct);

        if (!hadDefault)
        {
            screen.DefaultPlaylistId = playlist.Id;
            await _context.SaveChangesAsync(ct);
        }

        _logger.LogInformation("Playlist {Id} created on screen {ScreenId}", playlist.Id, request.ScreenId);

        return ToDto(playlist, screen.DefaultPlaylistId == playlist.Id);
    }

    public async Task<CmsPlaylistDto> UpdateAsync(Guid ownerId, Guid playlistId, UpdateCmsPlaylistRequest request, CancellationToken ct = default)
    {
        var playlist = await LoadOwnedPlaylistAsync(ownerId, playlistId, tracked: true, ct);

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new ArgumentException("Playlist name is required");
        }
        if (!Enum.TryParse<PlaylistType>(request.PlaylistType, true, out var playlistType))
        {
            throw new ArgumentException($"Invalid playlist type: {request.PlaylistType}");
        }

        playlist.Name = request.Name.Trim();
        playlist.PlaylistType = playlistType;
        await _context.SaveChangesAsync(ct);

        var defaultId = await _context.Screens
            .AsNoTracking()
            .Where(s => s.Id == playlist.ScreenId)
            .Select(s => s.DefaultPlaylistId)
            .FirstOrDefaultAsync(ct);

        return ToDto(playlist, defaultId == playlist.Id);
    }

    public async Task<CmsPlaylistDto> ReplaceItemsAsync(Guid ownerId, Guid playlistId, ReplacePlaylistItemsRequest request, CancellationToken ct = default)
    {
        var playlist = await LoadOwnedPlaylistAsync(ownerId, playlistId, tracked: true, ct);

        if (playlist.Version != request.ExpectedVersion)
        {
            throw new InvalidOperationException(
                $"Playlist was modified by another request (expected version {request.ExpectedVersion}, current {playlist.Version})");
        }

        // Validate all referenced media assets belong to this owner.
        var mediaIds = request.Items.Select(i => i.MediaAssetId).Distinct().ToList();
        var ownedMediaIds = await _context.MediaAssets
            .AsNoTracking()
            .Where(m => m.OwnerId == ownerId && mediaIds.Contains(m.Id) && m.IsReady)
            .Select(m => m.Id)
            .ToListAsync(ct);
        if (ownedMediaIds.Count != mediaIds.Count)
        {
            throw new InvalidOperationException("One or more media assets are missing or not ready");
        }

        // Remove existing items, add new ones. Simpler than diffing for now.
        var existing = await _context.PlaylistItems
            .Where(i => i.PlaylistId == playlistId)
            .ToListAsync(ct);
        _context.PlaylistItems.RemoveRange(existing);

        var order = 0;
        foreach (var input in request.Items)
        {
            if (!Enum.TryParse<PlaylistItemType>(input.ItemType, true, out var itemType))
            {
                throw new ArgumentException($"Invalid item type: {input.ItemType}");
            }

            // Images and HTML5 must specify duration; videos are optional.
            if ((itemType == PlaylistItemType.Image || itemType == PlaylistItemType.Html5) &&
                (!input.DurationSeconds.HasValue || input.DurationSeconds <= 0))
            {
                throw new ArgumentException("Duration is required for image and HTML5 items");
            }

            _context.PlaylistItems.Add(new PlaylistItem
            {
                PlaylistId = playlistId,
                MediaAssetId = input.MediaAssetId,
                ItemType = itemType,
                Order = order++,
                DurationSeconds = input.DurationSeconds
            });
        }

        playlist.Version += 1;
        playlist.LastPublishedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Playlist {Id} items replaced (new version {Version}, {Count} items)",
            playlistId, playlist.Version, request.Items.Count);

        return await GetAsync(ownerId, playlistId, ct);
    }

    public async Task DeleteAsync(Guid ownerId, Guid playlistId, CancellationToken ct = default)
    {
        var playlist = await LoadOwnedPlaylistAsync(ownerId, playlistId, tracked: true, ct);

        // If this was the screen's default, clear it.
        var screen = await _context.Screens.FirstAsync(s => s.Id == playlist.ScreenId, ct);
        if (screen.DefaultPlaylistId == playlistId)
        {
            screen.DefaultPlaylistId = null;
        }

        playlist.IsDeleted = true;
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Playlist {Id} deleted", playlistId);
    }

    public async Task SetDefaultAsync(Guid ownerId, Guid screenId, Guid playlistId, CancellationToken ct = default)
    {
        await EnsureScreenOwnedAsync(ownerId, screenId, ct);

        var playlistExists = await _context.Playlists
            .AnyAsync(p => p.Id == playlistId && p.ScreenId == screenId, ct);
        if (!playlistExists)
        {
            throw new InvalidOperationException("Playlist does not belong to this screen");
        }

        var screen = await _context.Screens.FirstAsync(s => s.Id == screenId, ct);
        screen.DefaultPlaylistId = playlistId;
        await _context.SaveChangesAsync(ct);
    }

    public async Task<CmsPlaylistDto?> GetDefaultForPlayerAsync(Guid screenId, CancellationToken ct = default)
    {
        var defaultPlaylistId = await _context.Screens
            .AsNoTracking()
            .Where(s => s.Id == screenId)
            .Select(s => s.DefaultPlaylistId)
            .FirstOrDefaultAsync(ct);

        if (!defaultPlaylistId.HasValue)
        {
            return null;
        }

        var playlist = await _context.Playlists
            .AsNoTracking()
            .Include(p => p.Items.OrderBy(i => i.Order))
                .ThenInclude(i => i.MediaAsset)
            .FirstOrDefaultAsync(p => p.Id == defaultPlaylistId.Value, ct);

        return playlist == null ? null : ToDto(playlist, isDefault: true);
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private async Task EnsureScreenOwnedAsync(Guid ownerId, Guid screenId, CancellationToken ct)
    {
        var ownsScreen = await _context.Screens
            .AnyAsync(s => s.Id == screenId && s.OwnerId == ownerId, ct);
        if (!ownsScreen)
        {
            // Information-hiding: same status for "not found" and "not yours".
            throw new KeyNotFoundException("Screen not found");
        }
    }

    private async Task<Playlist> LoadOwnedPlaylistAsync(Guid ownerId, Guid playlistId, bool tracked, CancellationToken ct)
    {
        var query = tracked
            ? _context.Playlists.AsQueryable()
            : _context.Playlists.AsNoTracking();

        var playlist = await query
            .Include(p => p.Items.OrderBy(i => i.Order))
                .ThenInclude(i => i.MediaAsset)
            .Include(p => p.Screen)
            .FirstOrDefaultAsync(p => p.Id == playlistId, ct);

        if (playlist == null || playlist.Screen.OwnerId != ownerId)
        {
            throw new KeyNotFoundException("Playlist not found");
        }
        return playlist;
    }

    private static CmsPlaylistDto ToDto(Playlist p, bool isDefault) => new()
    {
        Id = p.Id,
        ScreenId = p.ScreenId,
        Name = p.Name,
        PlaylistType = p.PlaylistType.ToString(),
        Version = p.Version,
        IsDefault = isDefault,
        LastPublishedAt = p.LastPublishedAt,
        Items = p.Items
            .OrderBy(i => i.Order)
            .Select(i => new CmsPlaylistItemDto
            {
                Id = i.Id,
                MediaAssetId = i.MediaAssetId,
                ItemType = i.ItemType.ToString(),
                Order = i.Order,
                DurationSeconds = i.DurationSeconds,
                MediaAsset = i.MediaAsset == null ? null : new MediaAssetDto
                {
                    Id = i.MediaAsset.Id,
                    OriginalName = i.MediaAsset.OriginalName,
                    MimeType = i.MediaAsset.MimeType,
                    SizeBytes = i.MediaAsset.SizeBytes,
                    FileUrl = i.MediaAsset.FileUrl,
                    ThumbnailUrl = i.MediaAsset.ThumbnailUrl,
                    Width = i.MediaAsset.Width,
                    Height = i.MediaAsset.Height,
                    DurationSeconds = i.MediaAsset.DurationSeconds,
                    IsReady = i.MediaAsset.IsReady,
                    CreatedAt = i.MediaAsset.CreatedAt
                }
            })
            .ToList()
    };
}
