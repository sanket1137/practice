using CCMS.Shared.DTOs.Player;

namespace CCMS.Application.Interfaces;

public interface IPlaylistService
{
    Task<PlaylistDto> GeneratePlaylistForScreenAsync(Guid screenId, DateTime date, CancellationToken cancellationToken = default);
    Task<PlaylistDto> GetTodayPlaylistAsync(string deviceId, CancellationToken cancellationToken = default);
}
