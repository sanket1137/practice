namespace CCMS.Shared.DTOs.Cms;

public class CmsPlaylistDto
{
    public Guid Id { get; set; }
    public Guid ScreenId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string PlaylistType { get; set; } = "Standard";
    public int Version { get; set; }
    public bool IsDefault { get; set; }
    public DateTime? LastPublishedAt { get; set; }
    public List<CmsPlaylistItemDto> Items { get; set; } = new();
}

public class CmsPlaylistItemDto
{
    public Guid Id { get; set; }
    public Guid MediaAssetId { get; set; }
    public string ItemType { get; set; } = "Image";
    public int Order { get; set; }
    public int? DurationSeconds { get; set; }
    public MediaAssetDto? MediaAsset { get; set; }
}

public class CreateCmsPlaylistRequest
{
    public Guid ScreenId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string PlaylistType { get; set; } = "Standard"; // Standard | Shuffle | Conditional
}

public class UpdateCmsPlaylistRequest
{
    public string Name { get; set; } = string.Empty;
    public string PlaylistType { get; set; } = "Standard";
}

/// <summary>Replaces the full ordered item list in one call (optimistic-concurrency via Version).</summary>
public class ReplacePlaylistItemsRequest
{
    public int ExpectedVersion { get; set; }
    public List<PlaylistItemInput> Items { get; set; } = new();
}

public class PlaylistItemInput
{
    public Guid MediaAssetId { get; set; }
    public string ItemType { get; set; } = "Image"; // Image | Video | Html5
    public int? DurationSeconds { get; set; }
}
