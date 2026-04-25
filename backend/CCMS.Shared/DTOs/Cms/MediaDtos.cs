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
}
