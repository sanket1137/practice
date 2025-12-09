using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using CCMS.Application.Interfaces;

namespace CCMS.Infrastructure.Services;

public class BlobStorageService : IBlobStorageService
{
    private readonly BlobServiceClient _blobServiceClient;
    private readonly string _containerName = "creatives";

    public BlobStorageService(BlobServiceClient blobServiceClient)
    {
        _blobServiceClient = blobServiceClient;
    }

    public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType)
    {
        // Get container client (create if doesn't exist)
        var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
        await containerClient.CreateIfNotExistsAsync(PublicAccessType.Blob);

        // Generate unique blob name
        var blobName = $"{Guid.NewGuid()}_{fileName}";
        var blobClient = containerClient.GetBlobClient(blobName);

        // Upload file
        var blobHttpHeaders = new BlobHttpHeaders
        {
            ContentType = contentType
        };

        await blobClient.UploadAsync(fileStream, new BlobUploadOptions
        {
            HttpHeaders = blobHttpHeaders
        });

        // Return blob URL
        return blobClient.Uri.ToString();
    }

    public async Task DeleteFileAsync(string fileUrl)
    {
        try
        {
            var uri = new Uri(fileUrl);
            var blobName = uri.Segments[^1]; // Get last segment (blob name)

            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
            var blobClient = containerClient.GetBlobClient(blobName);

            await blobClient.DeleteIfExistsAsync();
        }
        catch (Exception)
        {
            // Log error but don't throw
        }
    }

    public async Task<Stream> DownloadFileAsync(string fileUrl)
    {
        var uri = new Uri(fileUrl);
        var blobName = uri.Segments[^1];

        var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
        var blobClient = containerClient.GetBlobClient(blobName);

        var response = await blobClient.DownloadAsync();
        return response.Value.Content;
    }
}
