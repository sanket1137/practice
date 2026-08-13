namespace CCMS.Shared.DTOs.Cms;

/// <summary>
/// Client computes SHA-256 of the file to upload and asks the server whether
/// it already exists. If so, we skip the upload entirely (dedupe).
/// </summary>
public class CheckSha256Request
{
    public string Sha256 { get; set; } = string.Empty;
}

public class CheckSha256Response
{
    public bool Exists { get; set; }
    public Guid? MediaAssetId { get; set; }
}

/// <summary>
/// Client asks for a presigned URL to PUT the file directly to R2. Server
/// creates a placeholder MediaAsset row (IsReady=false) and returns the URL.
/// </summary>
public class PresignUploadRequest
{
    public string Sha256 { get; set; } = string.Empty;
    public string OriginalName { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
}

public class PresignUploadResponse
{
    public Guid MediaAssetId { get; set; }
    public string UploadUrl { get; set; } = string.Empty;
    public string ObjectKey { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}

/// <summary>
/// Client calls this after the PUT to R2 succeeds. Server verifies the object
/// exists and marks the asset IsReady, optionally setting media metadata.
/// </summary>
public class FinalizeUploadRequest
{
    public Guid MediaAssetId { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public decimal? DurationSeconds { get; set; }
}

public class MediaAssetDto
{
    public Guid Id { get; set; }
    public string OriginalName { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string FileUrl { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public decimal? DurationSeconds { get; set; }
    public bool IsReady { get; set; }
    public DateTime CreatedAt { get; set; }

    // Phase 1 Media Library extensions
    public string? Title { get; set; }
    public List<string> Tags { get; set; } = new();
    public Guid? CollectionId { get; set; }
    public bool IsFavorite { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public string AssetType { get; set; } = "Other"; // Image|Video|Html|Other
}

/// <summary>
/// Optional filters for listing assets in the media library.
/// Any null/empty filter is ignored.
/// </summary>
public class MediaLibraryFilters
{
    public string? Search { get; set; }
    public List<string>? Tags { get; set; }
    public Guid? CollectionId { get; set; }
    /// <summary>Image | Video | Html | Other</summary>
    public string? AssetType { get; set; }
    public bool FavoritesOnly { get; set; }
    /// <summary>When true, order by LastUsedAt desc and return only assets that have been used at least once.</summary>
    public bool RecentlyUsed { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

/// <summary>
/// Edit metadata of an existing asset. Null fields are not changed.
/// Tags fully replace the existing list when provided.
/// </summary>
public class UpdateMediaAssetRequest
{
    public string? Title { get; set; }
    public List<string>? Tags { get; set; }
    public Guid? CollectionId { get; set; }
    /// <summary>Pass null to keep, true/false to set explicitly. Prefer the dedicated toggle endpoint.</summary>
    public bool? IsFavorite { get; set; }
}

public class MediaCollectionDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int AssetCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateMediaCollectionRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
}
