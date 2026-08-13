using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using CCMS.Shared.DTOs.Screens;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CCMS.Infrastructure.Services;

/// <summary>
/// Service for managing screen images
/// </summary>
public class ScreenImageService : IScreenImageService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IFileStorageService _fileStorageService;
    private readonly ILogger<ScreenImageService> _logger;
    
    public ScreenImageService(
        ApplicationDbContext dbContext,
        IFileStorageService fileStorageService,
        ILogger<ScreenImageService> logger)
    {
        _dbContext = dbContext;
        _fileStorageService = fileStorageService;
        _logger = logger;
    }
    
    public async Task<UploadScreenImagesResponse> UploadImagesAsync(
        Guid screenId, 
        IEnumerable<ImageUploadFile> files, 
        string imageType,
        CancellationToken cancellationToken = default)
    {
        var response = new UploadScreenImagesResponse();
        var fileList = files.ToList();
        
        // Validate screen exists
        var screen = await _dbContext.Screens
            .FirstOrDefaultAsync(s => s.Id == screenId, cancellationToken);
            
        if (screen == null)
        {
            response.Errors.Add("Screen not found");
            return response;
        }
        
        // Parse image type
        if (!Enum.TryParse<ScreenImageType>(imageType, true, out var parsedImageType))
        {
            response.Errors.Add("Invalid image type. Must be 'Screen' or 'Surrounding'");
            return response;
        }
        
        // Validate file limits
        var currentCounts = await GetCurrentImageCountsAsync(screenId, cancellationToken);
        var newScreenCount = parsedImageType == ScreenImageType.Screen ? fileList.Count : 0;
        var newSurroundingCount = parsedImageType == ScreenImageType.Surrounding ? fileList.Count : 0;
        
        var (isValid, errorMessage) = ValidateImageLimits(currentCounts, newScreenCount, newSurroundingCount);
        if (!isValid)
        {
            response.Errors.Add(errorMessage!);
            return response;
        }
        
        // Get next display order
        var maxOrder = await _dbContext.ScreenImages
            .Where(si => si.ScreenId == screenId)
            .MaxAsync(si => (int?)si.DisplayOrder, cancellationToken) ?? -1;
        var nextOrder = maxOrder + 1;
        
        // Check if this is the first image (to set as primary)
        var hasExistingImages = currentCounts.screenPhotos > 0 || currentCounts.surroundingPhotos > 0;
        
        foreach (var file in fileList)
        {
            try
            {
                // Validate file
                var validationError = ValidateFile(file);
                if (validationError != null)
                {
                    response.Errors.Add($"{file.FileName}: {validationError}");
                    continue;
                }
                
                // Generate storage path: Screens/{screenId}/{type}_{guid}.{ext}
                var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
                var storageName = $"Screens/{screenId}/{imageType.ToLower()}_{Guid.NewGuid()}{extension}";
                
                // Upload to storage
                var imageUrl = await _fileStorageService.UploadFileAsync(
                    file.Stream, 
                    storageName, 
                    file.ContentType,
                    cancellationToken);
                
                // Create database record
                var screenImage = new ScreenImage
                {
                    Id = Guid.NewGuid(),
                    ScreenId = screenId,
                    ImageUrl = imageUrl,
                    ImageType = parsedImageType,
                    DisplayOrder = nextOrder++,
                    IsPrimary = !hasExistingImages && response.UploadedImages.Count == 0, // First image is primary
                    OriginalFileName = file.FileName,
                    SizeBytes = file.Length,
                    ContentType = file.ContentType,
                    UploadedAt = DateTime.UtcNow
                };
                
                _dbContext.ScreenImages.Add(screenImage);
                
                response.UploadedImages.Add(new ScreenImageDto
                {
                    Id = screenImage.Id,
                    ImageUrl = screenImage.ImageUrl,
                    ImageType = parsedImageType.ToString(),
                    DisplayOrder = screenImage.DisplayOrder,
                    IsPrimary = screenImage.IsPrimary,
                    OriginalFileName = screenImage.OriginalFileName,
                    SizeBytes = screenImage.SizeBytes,
                    UploadedAt = screenImage.UploadedAt
                });
                
                _logger.LogInformation(
                    "Uploaded {ImageType} image for screen {ScreenId}: {FileName}", 
                    imageType, screenId, file.FileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to upload image {FileName} for screen {ScreenId}", 
                    file.FileName, screenId);
                response.Errors.Add($"{file.FileName}: Upload failed - {ex.Message}");
            }
        }
        
        if (response.UploadedImages.Any())
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
            response.Success = true;
            response.Message = $"Successfully uploaded {response.UploadedImages.Count} image(s)";
        }
        
        return response;
    }
    
    public async Task<bool> DeleteImageAsync(Guid screenId, Guid imageId, CancellationToken cancellationToken = default)
    {
        var image = await _dbContext.ScreenImages
            .FirstOrDefaultAsync(si => si.Id == imageId && si.ScreenId == screenId, cancellationToken);
            
        if (image == null)
        {
            _logger.LogWarning("Image {ImageId} not found for screen {ScreenId}", imageId, screenId);
            return false;
        }
        
        // Check if this would leave the screen with no images
        var totalImages = await _dbContext.ScreenImages
            .CountAsync(si => si.ScreenId == screenId, cancellationToken);
            
        if (totalImages <= ScreenImageValidation.MinTotalImages)
        {
            _logger.LogWarning("Cannot delete image - screen must have at least {Min} image(s)", 
                ScreenImageValidation.MinTotalImages);
            return false;
        }
        
        // Delete from storage
        try
        {
            await _fileStorageService.DeleteFileAsync(image.ImageUrl, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete image file from storage: {ImageUrl}", image.ImageUrl);
            // Continue with database deletion even if storage delete fails
        }
        
        // If deleting primary image, set another as primary
        if (image.IsPrimary)
        {
            var nextPrimary = await _dbContext.ScreenImages
                .Where(si => si.ScreenId == screenId && si.Id != imageId)
                .OrderBy(si => si.DisplayOrder)
                .FirstOrDefaultAsync(cancellationToken);
                
            if (nextPrimary != null)
            {
                nextPrimary.IsPrimary = true;
            }
        }
        
        _dbContext.ScreenImages.Remove(image);
        await _dbContext.SaveChangesAsync(cancellationToken);
        
        _logger.LogInformation("Deleted image {ImageId} from screen {ScreenId}", imageId, screenId);
        return true;
    }
    
    public async Task<bool> SetPrimaryImageAsync(Guid screenId, Guid imageId, CancellationToken cancellationToken = default)
    {
        var images = await _dbContext.ScreenImages
            .Where(si => si.ScreenId == screenId)
            .ToListAsync(cancellationToken);
            
        var newPrimary = images.FirstOrDefault(i => i.Id == imageId);
        if (newPrimary == null)
        {
            _logger.LogWarning("Image {ImageId} not found for screen {ScreenId}", imageId, screenId);
            return false;
        }
        
        // Reset all to non-primary
        foreach (var img in images)
        {
            img.IsPrimary = img.Id == imageId;
        }
        
        await _dbContext.SaveChangesAsync(cancellationToken);
        
        _logger.LogInformation("Set image {ImageId} as primary for screen {ScreenId}", imageId, screenId);
        return true;
    }
    
    public async Task<bool> ReorderImagesAsync(Guid screenId, List<Guid> imageIds, CancellationToken cancellationToken = default)
    {
        var images = await _dbContext.ScreenImages
            .Where(si => si.ScreenId == screenId)
            .ToListAsync(cancellationToken);
            
        if (images.Count != imageIds.Count || !images.All(i => imageIds.Contains(i.Id)))
        {
            _logger.LogWarning("Invalid image IDs provided for reordering screen {ScreenId}", screenId);
            return false;
        }
        
        for (int i = 0; i < imageIds.Count; i++)
        {
            var image = images.First(img => img.Id == imageIds[i]);
            image.DisplayOrder = i;
        }
        
        await _dbContext.SaveChangesAsync(cancellationToken);
        
        _logger.LogInformation("Reordered {Count} images for screen {ScreenId}", imageIds.Count, screenId);
        return true;
    }
    
    public async Task<List<ScreenImageDto>> GetImagesAsync(Guid screenId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.ScreenImages
            .Where(si => si.ScreenId == screenId)
            .OrderBy(si => si.DisplayOrder)
            .Select(si => new ScreenImageDto
            {
                Id = si.Id,
                ImageUrl = si.ImageUrl,
                ImageType = si.ImageType.ToString(),
                DisplayOrder = si.DisplayOrder,
                IsPrimary = si.IsPrimary,
                OriginalFileName = si.OriginalFileName,
                SizeBytes = si.SizeBytes,
                ContentType = si.ContentType,
                Width = si.Width,
                Height = si.Height,
                UploadedAt = si.UploadedAt
            })
            .ToListAsync(cancellationToken);
    }
    
    public async Task<(bool IsValid, string? ErrorMessage)> ValidateImageLimitsAsync(
        Guid screenId, 
        int newScreenPhotoCount, 
        int newSurroundingPhotoCount,
        CancellationToken cancellationToken = default)
    {
        var currentCounts = await GetCurrentImageCountsAsync(screenId, cancellationToken);
        return ValidateImageLimits(currentCounts, newScreenPhotoCount, newSurroundingPhotoCount);
    }
    
    private async Task<(int screenPhotos, int surroundingPhotos)> GetCurrentImageCountsAsync(
        Guid screenId, 
        CancellationToken cancellationToken)
    {
        var counts = await _dbContext.ScreenImages
            .Where(si => si.ScreenId == screenId)
            .GroupBy(si => si.ImageType)
            .Select(g => new { Type = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);
            
        var screenPhotos = counts.FirstOrDefault(c => c.Type == ScreenImageType.Screen)?.Count ?? 0;
        var surroundingPhotos = counts.FirstOrDefault(c => c.Type == ScreenImageType.Surrounding)?.Count ?? 0;
        
        return (screenPhotos, surroundingPhotos);
    }
    
    private static (bool IsValid, string? ErrorMessage) ValidateImageLimits(
        (int screenPhotos, int surroundingPhotos) current,
        int newScreenCount,
        int newSurroundingCount)
    {
        var totalScreenPhotos = current.screenPhotos + newScreenCount;
        var totalSurroundingPhotos = current.surroundingPhotos + newSurroundingCount;
        
        if (totalScreenPhotos > ScreenImageValidation.MaxScreenPhotos)
        {
            return (false, $"Maximum {ScreenImageValidation.MaxScreenPhotos} screen photos allowed. Currently have {current.screenPhotos}, trying to add {newScreenCount}");
        }
        
        if (totalSurroundingPhotos > ScreenImageValidation.MaxSurroundingPhotos)
        {
            return (false, $"Maximum {ScreenImageValidation.MaxSurroundingPhotos} surrounding photos allowed. Currently have {current.surroundingPhotos}, trying to add {newSurroundingCount}");
        }
        
        return (true, null);
    }
    
    private static string? ValidateFile(ImageUploadFile file)
    {
        if (file.Length == 0)
        {
            return "File is empty";
        }
        
        if (file.Length > ScreenImageValidation.MaxFileSizeBytes)
        {
            return $"File size exceeds maximum of {ScreenImageValidation.MaxFileSizeBytes / (1024 * 1024)}MB";
        }
        
        if (!ScreenImageValidation.AllowedContentTypes.Contains(file.ContentType.ToLowerInvariant()))
        {
            return $"Invalid content type. Allowed: {string.Join(", ", ScreenImageValidation.AllowedContentTypes)}";
        }
        
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!ScreenImageValidation.AllowedExtensions.Contains(extension))
        {
            return $"Invalid file extension. Allowed: {string.Join(", ", ScreenImageValidation.AllowedExtensions)}";
        }
        
        return null;
    }
}
