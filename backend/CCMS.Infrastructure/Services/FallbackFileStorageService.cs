using CCMS.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace CCMS.Infrastructure.Services;

/// <summary>
/// Composite file storage service that attempts primary storage (e.g. R2 / Azure)
/// and falls back to local file storage if the primary storage service fails.
/// </summary>
public class FallbackFileStorageService : IFileStorageService
{
    private readonly IFileStorageService _primary;
    private readonly IFileStorageService _fallback;
    private readonly ILogger<FallbackFileStorageService> _logger;

    public FallbackFileStorageService(
        IFileStorageService primary,
        IFileStorageService fallback,
        ILogger<FallbackFileStorageService> logger)
    {
        _primary = primary;
        _fallback = fallback;
        _logger = logger;
    }

    public async Task<string> UploadFileAsync(
        Stream fileStream,
        string fileName,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await _primary.UploadFileAsync(fileStream, fileName, contentType, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[FileStorage] Primary storage upload failed ({Message}). Falling back to local storage.", ex.Message);

            if (fileStream.CanSeek)
            {
                fileStream.Position = 0;
            }

            return await _fallback.UploadFileAsync(fileStream, fileName, contentType, cancellationToken);
        }
    }

    public async Task<bool> DeleteFileAsync(string fileUrl, CancellationToken cancellationToken = default)
    {
        try
        {
            var primaryDeleted = await _primary.DeleteFileAsync(fileUrl, cancellationToken);
            if (primaryDeleted) return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[FileStorage] Primary storage delete failed. Trying fallback storage.");
        }

        return await _fallback.DeleteFileAsync(fileUrl, cancellationToken);
    }

    public async Task<Stream> GetFileAsync(string fileUrl, CancellationToken cancellationToken = default)
    {
        try
        {
            return await _primary.GetFileAsync(fileUrl, cancellationToken);
        }
        catch
        {
            return await _fallback.GetFileAsync(fileUrl, cancellationToken);
        }
    }

    public string GetFileUrl(string fileName)
    {
        try
        {
            return _primary.GetFileUrl(fileName);
        }
        catch
        {
            return _fallback.GetFileUrl(fileName);
        }
    }
}
