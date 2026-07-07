using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Cms;

namespace CCMS.Application.Interfaces;

public interface ICmsMediaService
{
    Task<CheckSha256Response> CheckSha256Async(Guid ownerId, string sha256, CancellationToken ct = default);

    Task<PresignUploadResponse> PresignUploadAsync(Guid ownerId, PresignUploadRequest request, CancellationToken ct = default);

    Task<MediaAssetDto> FinalizeUploadAsync(Guid ownerId, FinalizeUploadRequest request, CancellationToken ct = default);

    Task<PagedResult<MediaAssetDto>> ListAsync(Guid ownerId, MediaLibraryFilters filters, CancellationToken ct = default);

    Task<MediaAssetDto> UpdateAssetAsync(Guid ownerId, Guid mediaAssetId, UpdateMediaAssetRequest request, CancellationToken ct = default);

    Task<bool> ToggleFavoriteAsync(Guid ownerId, Guid mediaAssetId, CancellationToken ct = default);

    Task<bool> DeleteAsync(Guid ownerId, Guid mediaAssetId, CancellationToken ct = default);

    // Collections
    Task<MediaCollectionDto> CreateCollectionAsync(Guid ownerId, CreateMediaCollectionRequest request, CancellationToken ct = default);

    Task<List<MediaCollectionDto>> ListCollectionsAsync(Guid ownerId, CancellationToken ct = default);

    Task<bool> DeleteCollectionAsync(Guid ownerId, Guid collectionId, CancellationToken ct = default);
}

