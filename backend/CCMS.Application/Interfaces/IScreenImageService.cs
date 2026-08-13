using CCMS.Domain.Entities;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Interfaces;

/// <summary>
/// Represents a file to be uploaded
/// </summary>
public class ImageUploadFile
{
    public required Stream Stream { get; set; }
    public required string FileName { get; set; }
    public required string ContentType { get; set; }
    public required long Length { get; set; }
}

public interface IScreenImageService
{
    /// <summary>
    /// Upload images for a screen
    /// </summary>
    /// <param name="screenId">The screen ID</param>
    /// <param name="files">The image files to upload</param>
    /// <param name="imageType">Type of images: "Screen" or "Surrounding"</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Upload result with uploaded image details</returns>
    Task<UploadScreenImagesResponse> UploadImagesAsync(
        Guid screenId, 
        IEnumerable<ImageUploadFile> files, 
        string imageType,
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Delete a screen image
    /// </summary>
    /// <param name="screenId">The screen ID</param>
    /// <param name="imageId">The image ID to delete</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task<bool> DeleteImageAsync(Guid screenId, Guid imageId, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Set an image as the primary image for a screen
    /// </summary>
    /// <param name="screenId">The screen ID</param>
    /// <param name="imageId">The image ID to set as primary</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task<bool> SetPrimaryImageAsync(Guid screenId, Guid imageId, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Reorder images for a screen
    /// </summary>
    /// <param name="screenId">The screen ID</param>
    /// <param name="imageIds">List of image IDs in the new order</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task<bool> ReorderImagesAsync(Guid screenId, List<Guid> imageIds, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Get all images for a screen
    /// </summary>
    /// <param name="screenId">The screen ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task<List<ScreenImageDto>> GetImagesAsync(Guid screenId, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Validate image upload limits
    /// </summary>
    /// <param name="screenId">The screen ID</param>
    /// <param name="newScreenPhotoCount">Number of new screen photos to add</param>
    /// <param name="newSurroundingPhotoCount">Number of new surrounding photos to add</param>
    /// <returns>Tuple of (isValid, errorMessage)</returns>
    Task<(bool IsValid, string? ErrorMessage)> ValidateImageLimitsAsync(
        Guid screenId, 
        int newScreenPhotoCount, 
        int newSurroundingPhotoCount,
        CancellationToken cancellationToken = default);
}
