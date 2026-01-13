using Amazon;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Transfer;
using Microsoft.Extensions.Configuration;
using CCMS.Application.Interfaces;

namespace CCMS.Infrastructure.Services;

/// <summary>
/// Cloudflare R2 storage service - S3-compatible object storage with zero egress fees
/// </summary>
public class R2StorageService : IFileStorageService
{
    private readonly IAmazonS3 _s3Client;
    private readonly string _bucketName;
    private readonly string _publicUrlBase;

    public R2StorageService(IConfiguration configuration)
    {
        Console.WriteLine("[R2Storage] Initializing Cloudflare R2 Storage Service...");
        
        var accountId = configuration["R2:AccountId"] 
            ?? throw new InvalidOperationException("R2 Account ID not configured");
        var accessKeyId = configuration["R2:AccessKeyId"] 
            ?? throw new InvalidOperationException("R2 Access Key ID not configured");
        var secretAccessKey = configuration["R2:SecretAccessKey"] 
            ?? throw new InvalidOperationException("R2 Secret Access Key not configured");
        
        _bucketName = configuration["R2:BucketName"] ?? "ccms-creatives";
        _publicUrlBase = configuration["R2:PublicUrlBase"] 
            ?? $"https://{_bucketName}.{accountId}.r2.cloudflarestorage.com";
        
        Console.WriteLine($"[R2Storage] Bucket: {_bucketName}");
        Console.WriteLine($"[R2Storage] Public URL: {_publicUrlBase}");
        
        // Create S3 client with R2 endpoint
        // CRITICAL: Disable chunked encoding for R2 compatibility
        var r2Endpoint = $"https://{accountId}.r2.cloudflarestorage.com";
        
        var config = new AmazonS3Config
        {
            ServiceURL = r2Endpoint,
            ForcePathStyle = true, // Required for R2
            SignatureVersion = "4"
        };
        
        _s3Client = new AmazonS3Client(accessKeyId, secretAccessKey, config);
        
        // Verify bucket access (async would be better but can't use in constructor)
        try
        {
            var listResponse = _s3Client.ListObjectsV2Async(new ListObjectsV2Request
            {
                BucketName = _bucketName,
                MaxKeys = 1
            }).GetAwaiter().GetResult();
            
            Console.WriteLine($"[R2Storage] Bucket '{_bucketName}' accessible");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[R2Storage] WARNING: Could not access bucket: {ex.Message}");
        }
    }

    public async Task<string> UploadFileAsync(
        Stream fileStream, 
        string fileName, 
        string contentType,
        CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"[R2Storage] Uploading file: {fileName}, Type: {contentType}");
        
        // Generate unique object key
        var fileExtension = Path.GetExtension(fileName);
        var objectKey = $"{Guid.NewGuid()}{fileExtension}";
        
        Console.WriteLine($"[R2Storage] Object key: {objectKey}");
        
        // Copy stream to MemoryStream to get the content length
        // This is required because R2 needs Content-Length header
        using var memoryStream = new MemoryStream();
        await fileStream.CopyToAsync(memoryStream, cancellationToken);
        memoryStream.Position = 0;
        
        Console.WriteLine($"[R2Storage] File size: {memoryStream.Length} bytes");
        
        var putRequest = new PutObjectRequest
        {
            BucketName = _bucketName,
            Key = objectKey,
            InputStream = memoryStream,
            ContentType = contentType,
            // Disable chunked encoding at request level too
            UseChunkEncoding = false
        };
        
        try
        {
            await _s3Client.PutObjectAsync(putRequest, cancellationToken);
            
            var publicUrl = $"{_publicUrlBase}/{objectKey}";
            Console.WriteLine($"[R2Storage] Upload SUCCESS! URL: {publicUrl}");
            
            return publicUrl;
        }
        catch (AmazonS3Exception ex)
        {
            Console.WriteLine($"[R2Storage] Upload FAILED: {ex.Message}");
            throw;
        }
    }

    public async Task<bool> DeleteFileAsync(string fileUrl, CancellationToken cancellationToken = default)
    {
        try
        {
            var objectKey = GetObjectKeyFromUrl(fileUrl);
            Console.WriteLine($"[R2Storage] Deleting object: {objectKey}");
            
            var deleteRequest = new DeleteObjectRequest
            {
                BucketName = _bucketName,
                Key = objectKey
            };
            
            await _s3Client.DeleteObjectAsync(deleteRequest, cancellationToken);
            Console.WriteLine($"[R2Storage] Delete SUCCESS: {objectKey}");
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[R2Storage] Delete FAILED: {ex.Message}");
            return false;
        }
    }

    public async Task<Stream> GetFileAsync(string fileUrl, CancellationToken cancellationToken = default)
    {
        var objectKey = GetObjectKeyFromUrl(fileUrl);
        Console.WriteLine($"[R2Storage] Getting object: {objectKey}");
        
        var getRequest = new GetObjectRequest
        {
            BucketName = _bucketName,
            Key = objectKey
        };
        
        try
        {
            var response = await _s3Client.GetObjectAsync(getRequest, cancellationToken);
            return response.ResponseStream;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            throw new FileNotFoundException("Object not found in R2", objectKey);
        }
    }

    public string GetFileUrl(string objectKey)
    {
        return $"{_publicUrlBase}/{objectKey}";
    }

    /// <summary>
    /// Generate a presigned URL for temporary access (useful for private buckets)
    /// </summary>
    public string GetPresignedUrl(string objectKey, TimeSpan expiry)
    {
        var request = new GetPreSignedUrlRequest
        {
            BucketName = _bucketName,
            Key = objectKey,
            Expires = DateTime.UtcNow.Add(expiry),
            Verb = HttpVerb.GET
        };
        
        return _s3Client.GetPreSignedURL(request);
    }

    private string GetObjectKeyFromUrl(string fileUrl)
    {
        // Extract object key from full URL
        // URL format: https://bucket.accountid.r2.cloudflarestorage.com/{objectKey}
        // or custom domain: https://cdn.yourdomain.com/{objectKey}
        var uri = new Uri(fileUrl);
        var objectKey = uri.AbsolutePath.TrimStart('/');
        return objectKey;
    }
}
