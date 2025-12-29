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
        _baseUrl = configuration["FileStorage:BaseUrl"] ?? "http://localhost:5000/uploads";
        
        Console.WriteLine($"[LocalFileStorage] Storage path: {_storagePath}");
        
        // Ensure directory exists
        if (!Directory.Exists(_storagePath))
        {
            Directory.CreateDirectory(_storagePath);
        }
    }

    public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType, CancellationToken cancellationToken = default)
    {
        // Generate unique filename
        var fileExtension = Path.GetExtension(fileName);
        var uniqueFilename = $"{Guid.NewGuid()}{fileExtension}";
        var filePath = Path.Combine(_storagePath, uniqueFilename);

        // Save file
        using (var fileWriteStream = File.Create(filePath))
        {
            await fileStream.CopyToAsync(fileWriteStream, cancellationToken);
        }

        // Return URL
        return GetFileUrl(uniqueFilename);
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
