using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Configuration;
using CCMS.Application.Interfaces;

namespace CCMS.Infrastructure.Services;

public class AzureBlobStorageService : IFileStorageService
{
    private readonly BlobServiceClient _blobServiceClient;
    private readonly string _containerName;
    private readonly BlobContainerClient _containerClient;

    public AzureBlobStorageService(IConfiguration configuration)
    {
        Console.WriteLine("[AzureBlobStorage] Initializing Azure Blob Storage Service...");
        
        var connectionString = configuration["AzureBlobStorage:ConnectionString"] 
            ?? throw new InvalidOperationException("Azure Blob Storage connection string not configured");
        
        _containerName = configuration["AzureBlobStorage:ContainerName"] ?? "creatives";
        
        Console.WriteLine($"[AzureBlobStorage] Container: {_containerName}");
        Console.WriteLine($"[AzureBlobStorage] Endpoint: {connectionString.Substring(0, Math.Min(100, connectionString.Length))}...");
        
        _blobServiceClient = new BlobServiceClient(connectionString);
        _containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
        
        // Create container if it doesn't exist (async would be better but can't use in constructor)
        try
        {
            _containerClient.CreateIfNotExists(PublicAccessType.Blob);
            Console.WriteLine($"[AzureBlobStorage] Container '{_containerName}' ready");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[AzureBlobStorage] WARNING: Could not create container: {ex.Message}");
        }
    }

    public async Task<string> UploadFileAsync(
        Stream fileStream, 
        string fileName, 
        string contentType,
        CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"[AzureBlobStorage] Uploading file: {fileName}, Type: {contentType}");
        
        // Generate unique blob name
        var fileExtension = Path.GetExtension(fileName);
        var blobName = $"{Guid.NewGuid()}{fileExtension}";
        
        Console.WriteLine($"[AzureBlobStorage] Blob name: {blobName}");
        
        var blobClient = _containerClient.GetBlobClient(blobName);
        
        // Upload with content type
        var blobHttpHeaders = new BlobHttpHeaders
        {
            ContentType = contentType
        };
        
        await blobClient.UploadAsync(
            fileStream,
            new BlobUploadOptions
            {
                HttpHeaders = blobHttpHeaders
            },
            cancellationToken);
        
        var blobUrl = blobClient.Uri.ToString();
        Console.WriteLine($"[AzureBlobStorage] Upload SUCCESS! URL: {blobUrl}");
        
        // Return blob URL
        return blobUrl;
    }

    public async Task<bool> DeleteFileAsync(string fileUrl, CancellationToken cancellationToken = default)
    {
        try
        {
            var blobName = GetBlobNameFromUrl(fileUrl);
            var blobClient = _containerClient.GetBlobClient(blobName);
            
            var response = await blobClient.DeleteIfExistsAsync(cancellationToken: cancellationToken);
            return response.Value;
        }
        catch
        {
            return false;
        }
    }

    public async Task<Stream> GetFileAsync(string fileUrl, CancellationToken cancellationToken = default)
    {
        var blobName = GetBlobNameFromUrl(fileUrl);
        var blobClient = _containerClient.GetBlobClient(blobName);
        
        if (!await blobClient.ExistsAsync(cancellationToken))
        {
            throw new FileNotFoundException("Blob not found", blobName);
        }
        
        var response = await blobClient.DownloadStreamingAsync(cancellationToken: cancellationToken);
        return response.Value.Content;
    }

    public string GetFileUrl(string blobName)
    {
        var blobClient = _containerClient.GetBlobClient(blobName);
        return blobClient.Uri.ToString();
    }

    private string GetBlobNameFromUrl(string fileUrl)
    {
        // Extract blob name from full URL
        // URL format: http://127.0.0.1:10000/devstoreaccount1/creatives/{blobName}
        var uri = new Uri(fileUrl);
        var segments = uri.Segments;
        return segments[segments.Length - 1];
    }
}
