using CCMS.Shared.DTOs.Cms;

namespace CCMS.Application.Interfaces;

public interface ICmsPlaylistService
{
    Task<List<CmsPlaylistDto>> ListForScreenAsync(Guid ownerId, Guid screenId, CancellationToken ct = default);
    Task<CmsPlaylistDto> GetAsync(Guid ownerId, Guid playlistId, CancellationToken ct = default);
    Task<CmsPlaylistDto> CreateAsync(Guid ownerId, CreateCmsPlaylistRequest request, CancellationToken ct = default);
    Task<CmsPlaylistDto> UpdateAsync(Guid ownerId, Guid playlistId, UpdateCmsPlaylistRequest request, CancellationToken ct = default);
    Task<CmsPlaylistDto> ReplaceItemsAsync(Guid ownerId, Guid playlistId, ReplacePlaylistItemsRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid ownerId, Guid playlistId, CancellationToken ct = default);
    Task SetDefaultAsync(Guid ownerId, Guid screenId, Guid playlistId, CancellationToken ct = default);

    /// <summary>
    /// Player-facing lookup: returns the screen's current default playlist.
    /// Skips ownerId checks because the caller (handshake / player hub) has
    /// already authenticated the device via its API key.
    /// </summary>
    Task<CmsPlaylistDto?> GetDefaultForPlayerAsync(Guid screenId, CancellationToken ct = default);
}
