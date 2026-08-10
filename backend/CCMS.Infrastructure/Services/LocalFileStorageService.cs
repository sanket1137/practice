using Microsoft.Extensions.Configuration;
using CCMS.Application.Interfaces;

namespace CCMS.Infrastructure.Services;

public class LocalFileStorageService : IFileStorageService
{
    private readonly string _storagePath;
    private readonly string _baseUrl;

    public LocalFileStorageService(IConfiguration configuration)
    {
        Console.WriteLine("[LocalFileStorage] Initializing LOCAL File Storage Service...");
        
        _storagePath = configuration["FileStorage:LocalPath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        var appBaseUrl = configuration["App:BaseUrl"] ?? configuration["FRONTEND_URL"] ?? "https://ccms.pixelspot.in";
        _baseUrl = configuration["FileStorage:BaseUrl"] ?? $"{appBaseUrl.TrimEnd('/')}/uploads";
        
        Console.WriteLine($"[LocalFileStorage] Storage path: {_storagePath}, BaseUrl: {_baseUrl}");
        
        // Ensure directory exists
        if (!Directory.Exists(_storagePath))
        {
            Directory.CreateDirectory(_storagePath);
        }
    }

    public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType, CancellationToken cancellationToken = default)
    {
        string relativePath;
        string filePath;
        
        // Check if fileName contains a path (directory structure)
        if (fileName.Contains('/') || fileName.Contains('\\'))
        {
            // Path provided - preserve directory structure
            relativePath = fileName.Replace('\\', '/');
            filePath = Path.Combine(_storagePath, relativePath.Replace('/', Path.DirectorySeparatorChar));
            
            // Ensure directory exists
            var directory = Path.GetDirectoryName(filePath);
            if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }
        }
        else
        {
            // No path provided - generate unique filename at root
            var fileExtension = Path.GetExtension(fileName);
            relativePath = $"{Guid.NewGuid()}{fileExtension}";
            filePath = Path.Combine(_storagePath, relativePath);
        }

        // Save file
        using (var fileWriteStream = File.Create(filePath))
        {
            await fileStream.CopyToAsync(fileWriteStream, cancellationToken);
        }

        // Return URL (use forward slashes for URL)
        return GetFileUrl(relativePath);
    }

    public Task<bool> DeleteFileAsync(string fileUrl, CancellationToken cancellationToken = default)
    {
        try
        {
            var fileName = Path.GetFileName(new Uri(fileUrl).LocalPath);
            var filePath = Path.Combine(_storagePath, fileName);

            if (File.Exists(filePath))
            {
                File.Delete(filePath);
                return Task.FromResult(true);
            }
        }
        catch
        {
            // File deletion failed
        }

        return Task.FromResult(false);
    }

    public Task<Stream> GetFileAsync(string fileUrl, CancellationToken cancellationToken = default)
    {
        var fileName = Path.GetFileName(new Uri(fileUrl).LocalPath);
        var filePath = Path.Combine(_storagePath, fileName);

        if (!File.Exists(filePath))
        {
            throw new FileNotFoundException("File not found", filePath);
        }

        return Task.FromResult<Stream>(File.OpenRead(filePath));
    }

    public string GetFileUrl(string fileName)
    {
        return $"{_baseUrl}/{fileName}";
    }
}
