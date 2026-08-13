using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Cms;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CCMS.Infrastructure.Services;

public class CmsMediaService : ICmsMediaService
{
    private static readonly TimeSpan UploadUrlLifetime = TimeSpan.FromMinutes(15);

    private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "video/mp4", "video/webm", "video/quicktime",
        "text/html"
    };

    private const long MaxSizeBytes = 500L * 1024 * 1024; // 500 MB hard cap per asset

    private readonly ApplicationDbContext _context;
    private readonly IPresignedUploadService _uploader;
    private readonly ILogger<CmsMediaService> _logger;

    public CmsMediaService(
        ApplicationDbContext context,
        IPresignedUploadService uploader,
        ILogger<CmsMediaService> logger)
    {
        _context = context;
        _uploader = uploader;
        _logger = logger;
    }

    public async Task<CheckSha256Response> CheckSha256Async(Guid ownerId, string sha256, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(sha256) || sha256.Length != 64)
        {
            throw new ArgumentException("SHA-256 must be a 64-character hex string", nameof(sha256));
        }

        var existing = await _context.MediaAssets
            .AsNoTracking()
            .Where(m => m.OwnerId == ownerId && m.Sha256 == sha256 && m.IsReady)
            .Select(m => new { m.Id })
            .FirstOrDefaultAsync(ct);

        return new CheckSha256Response
        {
            Exists = existing != null,
            MediaAssetId = existing?.Id
        };
    }

    public async Task<PresignUploadResponse> PresignUploadAsync(Guid ownerId, PresignUploadRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Sha256) || request.Sha256.Length != 64)
        {
            throw new ArgumentException("Invalid SHA-256");
        }
        if (request.SizeBytes <= 0 || request.SizeBytes > MaxSizeBytes)
        {
            throw new ArgumentException("File size out of range (1 byte - 500 MB)");
        }
        if (!AllowedMimeTypes.Contains(request.MimeType))
        {
            throw new ArgumentException($"Unsupported MIME type: {request.MimeType}");
        }

        // If a ready copy already exists under this owner+sha256, surface it
        // rather than allocating a new object key.
        var ready = await _context.MediaAssets
            .FirstOrDefaultAsync(m => m.OwnerId == ownerId && m.Sha256 == request.Sha256 && m.IsReady, ct);
        if (ready != null)
        {
            return new PresignUploadResponse
            {
                MediaAssetId = ready.Id,
                UploadUrl = string.Empty,
                ObjectKey = string.Empty,
                ExpiresAt = DateTime.UtcNow
            };
        }

        var extension = GetExtension(request.MimeType, request.OriginalName);
        // Content-addressed key: the SHA-256 IS the filename (within owner's folder).
        // Same content under different names collapses to one object in R2.
        var objectKey = $"cms/{ownerId}/{request.Sha256}{extension}";
        var publicUrl = _uploader.GetPublicUrl(objectKey);

        var asset = new MediaAsset
        {
            OwnerId = ownerId,
            Sha256 = request.Sha256,
            OriginalName = request.OriginalName,
            MimeType = request.MimeType,
            SizeBytes = request.SizeBytes,
            FileUrl = publicUrl,
            IsReady = false
        };
        _context.MediaAssets.Add(asset);

        try
        {
            await _context.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Concurrent presign for the same content — just surface the row
            // that now exists (the unique (OwnerId, Sha256) index tripped).
            _context.Entry(asset).State = EntityState.Detached;
            var concurrent = await _context.MediaAssets
                .FirstAsync(m => m.OwnerId == ownerId && m.Sha256 == request.Sha256, ct);
            asset = concurrent;
        }

        var uploadUrl = _uploader.GetPresignedUploadUrl(objectKey, request.MimeType, UploadUrlLifetime);

        _logger.LogInformation("Presigned upload for owner {OwnerId} sha256 {Sha256} size {Size}",
            ownerId, request.Sha256, request.SizeBytes);

        return new PresignUploadResponse
        {
            MediaAssetId = asset.Id,
            UploadUrl = uploadUrl,
            ObjectKey = objectKey,
            ExpiresAt = DateTime.UtcNow.Add(UploadUrlLifetime)
        };
    }

    public async Task<MediaAssetDto> FinalizeUploadAsync(Guid ownerId, FinalizeUploadRequest request, CancellationToken ct = default)
    {
        var asset = await _context.MediaAssets
            .FirstOrDefaultAsync(m => m.Id == request.MediaAssetId && m.OwnerId == ownerId, ct)
            ?? throw new InvalidOperationException("Media asset not found");

        if (asset.IsReady) return ToDto(asset);

        // Derive object key from the public URL so we can verify the object exists.
        var objectKey = DeriveObjectKey(asset.FileUrl);
        var exists = await _uploader.ObjectExistsAsync(objectKey, ct);
        if (!exists)
        {
            throw new InvalidOperationException("Upload not found in storage — please retry the upload");
        }

        asset.IsReady = true;
        asset.Width = request.Width;
        asset.Height = request.Height;
        asset.DurationSeconds = request.DurationSeconds;
        asset.AssetType = ClassifyAssetType(asset.MimeType);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Media asset {Id} finalized for owner {OwnerId}", asset.Id, ownerId);

        return ToDto(asset);
    }

    public async Task<PagedResult<MediaAssetDto>> ListAsync(Guid ownerId, MediaLibraryFilters filters, CancellationToken ct = default)
    {
        var page = Math.Max(1, filters.Page);
        var pageSize = Math.Clamp(filters.PageSize, 1, 100);

        var query = _context.MediaAssets
            .AsNoTracking()
            .Where(m => m.OwnerId == ownerId && m.IsReady);

        if (!string.IsNullOrWhiteSpace(filters.Search))
        {
            var s = filters.Search.Trim().ToLower();
            query = query.Where(m =>
                (m.Title != null && m.Title.ToLower().Contains(s)) ||
                m.OriginalName.ToLower().Contains(s));
        }

        if (filters.Tags != null && filters.Tags.Count > 0)
        {
            // Postgres text[] && operator (overlaps any). EF Core npgsql maps List<string>.Any(...).
            foreach (var tag in filters.Tags)
            {
                var needle = tag;
                query = query.Where(m => m.Tags.Contains(needle));
            }
        }

        if (filters.CollectionId.HasValue)
        {
            var cid = filters.CollectionId.Value;
            query = query.Where(m => m.CollectionId == cid);
        }

        if (!string.IsNullOrWhiteSpace(filters.AssetType) &&
            Enum.TryParse<MediaAssetType>(filters.AssetType, true, out var typeFilter))
        {
            query = query.Where(m => m.AssetType == typeFilter);
        }

        if (filters.FavoritesOnly)
        {
            query = query.Where(m => m.IsFavorite);
        }

        if (filters.RecentlyUsed)
        {
            query = query.Where(m => m.LastUsedAt != null)
                         .OrderByDescending(m => m.LastUsedAt);
        }
        else
        {
            query = query.OrderByDescending(m => m.CreatedAt);
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(m => new MediaAssetDto
            {
                Id = m.Id,
                OriginalName = m.OriginalName,
                MimeType = m.MimeType,
                SizeBytes = m.SizeBytes,
                FileUrl = m.FileUrl,
                ThumbnailUrl = m.ThumbnailUrl,
                Width = m.Width,
                Height = m.Height,
                DurationSeconds = m.DurationSeconds,
                IsReady = m.IsReady,
                CreatedAt = m.CreatedAt,
                Title = m.Title,
                Tags = m.Tags,
                CollectionId = m.CollectionId,
                IsFavorite = m.IsFavorite,
                LastUsedAt = m.LastUsedAt,
                AssetType = m.AssetType.ToString()
            })
            .ToListAsync(ct);

        return new PagedResult<MediaAssetDto>
        {
            Items = items,
            TotalCount = total,
            PageNumber = page,
            PageSize = pageSize
        };
    }

    public async Task<MediaAssetDto> UpdateAssetAsync(Guid ownerId, Guid mediaAssetId, UpdateMediaAssetRequest request, CancellationToken ct = default)
    {
        var asset = await _context.MediaAssets
            .FirstOrDefaultAsync(m => m.Id == mediaAssetId && m.OwnerId == ownerId, ct)
            ?? throw new InvalidOperationException("Media asset not found");

        if (request.Title != null) asset.Title = string.IsNullOrWhiteSpace(request.Title) ? null : request.Title.Trim();
        if (request.Tags != null)
        {
            asset.Tags = request.Tags
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .Select(t => t.Trim().ToLowerInvariant())
                .Distinct()
                .Take(20)
                .ToList();
        }
        if (request.CollectionId.HasValue)
        {
            // Validate the collection belongs to the same owner; null clears it.
            if (request.CollectionId.Value == Guid.Empty)
            {
                asset.CollectionId = null;
            }
            else
            {
                var ok = await _context.MediaCollections
                    .AnyAsync(c => c.Id == request.CollectionId.Value && c.OwnerId == ownerId, ct);
                if (!ok) throw new InvalidOperationException("Collection not found");
                asset.CollectionId = request.CollectionId.Value;
            }
        }
        if (request.IsFavorite.HasValue) asset.IsFavorite = request.IsFavorite.Value;

        await _context.SaveChangesAsync(ct);
        return ToDto(asset);
    }

    public async Task<bool> ToggleFavoriteAsync(Guid ownerId, Guid mediaAssetId, CancellationToken ct = default)
    {
        var asset = await _context.MediaAssets
            .FirstOrDefaultAsync(m => m.Id == mediaAssetId && m.OwnerId == ownerId, ct)
            ?? throw new InvalidOperationException("Media asset not found");

        asset.IsFavorite = !asset.IsFavorite;
        await _context.SaveChangesAsync(ct);
        return asset.IsFavorite;
    }

    public async Task<MediaCollectionDto> CreateCollectionAsync(Guid ownerId, CreateMediaCollectionRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Collection name is required");

        var name = request.Name.Trim();
        var duplicate = await _context.MediaCollections
            .AnyAsync(c => c.OwnerId == ownerId && c.Name == name, ct);
        if (duplicate) throw new InvalidOperationException("A collection with this name already exists");

        var collection = new MediaCollection
        {
            OwnerId = ownerId,
            Name = name,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim()
        };
        _context.MediaCollections.Add(collection);
        await _context.SaveChangesAsync(ct);

        return new MediaCollectionDto
        {
            Id = collection.Id,
            Name = collection.Name,
            Description = collection.Description,
            AssetCount = 0,
            CreatedAt = collection.CreatedAt
        };
    }

    public async Task<List<MediaCollectionDto>> ListCollectionsAsync(Guid ownerId, CancellationToken ct = default)
    {
        return await _context.MediaCollections
            .AsNoTracking()
            .Where(c => c.OwnerId == ownerId)
            .OrderBy(c => c.Name)
            .Select(c => new MediaCollectionDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                AssetCount = _context.MediaAssets.Count(m => m.CollectionId == c.Id && m.IsReady),
                CreatedAt = c.CreatedAt
            })
            .ToListAsync(ct);
    }

    public async Task<bool> DeleteCollectionAsync(Guid ownerId, Guid collectionId, CancellationToken ct = default)
    {
        var collection = await _context.MediaCollections
            .FirstOrDefaultAsync(c => c.Id == collectionId && c.OwnerId == ownerId, ct);
        if (collection == null) return false;

        // Detach assets from the collection rather than deleting them (FK is SetNull anyway).
        var assets = await _context.MediaAssets
            .Where(m => m.CollectionId == collectionId)
            .ToListAsync(ct);
        foreach (var a in assets) a.CollectionId = null;

        collection.IsDeleted = true;
        await _context.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeleteAsync(Guid ownerId, Guid mediaAssetId, CancellationToken ct = default)
    {
        var asset = await _context.MediaAssets
            .FirstOrDefaultAsync(m => m.Id == mediaAssetId && m.OwnerId == ownerId, ct);
        if (asset == null) return false;

        // Block delete if any playlist item references this asset — dedupe means
        // one asset may back several playlists.
        var inUse = await _context.PlaylistItems.AnyAsync(p => p.MediaAssetId == mediaAssetId, ct);
        if (inUse)
        {
            throw new InvalidOperationException("Cannot delete — asset is used by one or more playlists");
        }

        asset.IsDeleted = true;
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Media asset {Id} soft-deleted by owner {OwnerId}", mediaAssetId, ownerId);
        return true;
    }

    private string DeriveObjectKey(string fileUrl)
    {
        var uri = new Uri(fileUrl);
        return uri.AbsolutePath.TrimStart('/');
    }

    private static MediaAssetDto ToDto(MediaAsset m) => new()
    {
        Id = m.Id,
        OriginalName = m.OriginalName,
        MimeType = m.MimeType,
        SizeBytes = m.SizeBytes,
        FileUrl = m.FileUrl,
        ThumbnailUrl = m.ThumbnailUrl,
        Width = m.Width,
        Height = m.Height,
        DurationSeconds = m.DurationSeconds,
        IsReady = m.IsReady,
        CreatedAt = m.CreatedAt,
        Title = m.Title,
        Tags = m.Tags,
        CollectionId = m.CollectionId,
        IsFavorite = m.IsFavorite,
        LastUsedAt = m.LastUsedAt,
        AssetType = m.AssetType.ToString()
    };

    private static MediaAssetType ClassifyAssetType(string mimeType)
    {
        if (string.IsNullOrWhiteSpace(mimeType)) return MediaAssetType.Other;
        var mt = mimeType.ToLowerInvariant();
        if (mt.StartsWith("image/")) return MediaAssetType.Image;
        if (mt.StartsWith("video/")) return MediaAssetType.Video;
        if (mt == "text/html") return MediaAssetType.Html;
        return MediaAssetType.Other;
    }

    private static string GetExtension(string mimeType, string originalName)
    {
        var fromName = Path.GetExtension(originalName);
        if (!string.IsNullOrWhiteSpace(fromName)) return fromName.ToLowerInvariant();

        return mimeType.ToLowerInvariant() switch
        {
            "image/jpeg" => ".jpg",
            "image/png" => ".png",
            "image/webp" => ".webp",
            "image/gif" => ".gif",
            "video/mp4" => ".mp4",
            "video/webm" => ".webm",
            "video/quicktime" => ".mov",
            "text/html" => ".html",
            _ => ""
        };
    }
}
