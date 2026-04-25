using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

/// <summary>
/// Ordered list of media items a CMS screen plays. One screen can have many
/// playlists; exactly one is assigned as the default via <c>Screen.DefaultPlaylistId</c>.
/// </summary>
public class Playlist : BaseEntity
{
    public Guid ScreenId { get; set; }
    public string Name { get; set; } = string.Empty;

    public PlaylistType PlaylistType { get; set; } = PlaylistType.Standard;

    /// <summary>
    /// Monotonically increasing version. Incremented on every publish;
    /// players use this to detect changes and re-download.
    /// </summary>
    public int Version { get; set; } = 1;

    public DateTime? LastPublishedAt { get; set; }

    // Navigation
    public virtual Screen Screen { get; set; } = null!;
    public virtual ICollection<PlaylistItem> Items { get; set; } = new List<PlaylistItem>();
}
