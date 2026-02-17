using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Transfer;
using Microsoft.Extensions.Configuration;
using CCMS.Application.Interfaces;
using System.Net;
using System.Net.Http;
using System.Security.Authentication;
using System.Text.Json;

namespace CCMS.Infrastructure.Services;

/// <summary>
/// Cloudflare R2 storage service - S3-compatible object storage with zero egress fees
/// </summary>
public class R2StorageService : IFileStorageService
{
    private readonly IAmazonS3 _s3Client;
    private readonly string _bucketName;
    private readonly string _basePath;
    private readonly string _publicUrlBase;
    private readonly string[] _corsAllowedOrigins;
    private bool _bucketVerified;
    private readonly object _verifyLock = new();

    public R2StorageService(IConfiguration configuration)
    {
        // Force TLS 1.2 for Cloudflare R2 compatibility
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls13;
        
        var accountId = configuration["R2:AccountId"] 
            ?? throw new InvalidOperationException("R2 Account ID not configured");
        var accessKeyId = configuration["R2:AccessKeyId"] 
            ?? throw new InvalidOperationException("R2 Access Key ID not configured");
        var secretAccessKey = configuration["R2:SecretAccessKey"] 
            ?? throw new InvalidOperationException("R2 Secret Access Key not configured");
        
        _bucketName = configuration["R2:BucketName"] ?? "ccms-creatives";
        _basePath = configuration["R2:BasePath"]?.Trim('/') ?? ""; // Remove leading/trailing slashes
        _publicUrlBase = configuration["R2:PublicUrlBase"] 
            ?? $"https://{_bucketName}.{accountId}.r2.cloudflarestorage.com";
        
        // Create S3 client with R2 endpoint
        var r2Endpoint = $"https://{accountId}.r2.cloudflarestorage.com";
        
        // Create custom HttpClient with TLS configuration
        var httpClientHandler = new HttpClientHandler
        {
            SslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13
        };
        
        var config = new AmazonS3Config
        {
            ServiceURL = r2Endpoint,
            ForcePathStyle = true, // Required for R2
            SignatureVersion = "4",
            HttpClientFactory = new R2HttpClientFactory(httpClientHandler)
        };
        
        _s3Client = new AmazonS3Client(accessKeyId, secretAccessKey, config);
        
        // Collect CORS allowed origins from configuration
        // These are the same origins allowed by the ASP.NET CORS policy
        var corsOrigins = new List<string>();
        var configuredOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
        if (configuredOrigins != null)
        {
            corsOrigins.AddRange(configuredOrigins);
        }
        // Ensure production domain is always included
        if (!corsOrigins.Contains("https://ccms.pixelspot.in"))
        {
            corsOrigins.Add("https://ccms.pixelspot.in");
        }
        _corsAllowedOrigins = corsOrigins.ToArray();
        
        // Log initialization once (no blocking bucket check)
        var pathInfo = string.IsNullOrEmpty(_basePath) ? "root" : $"/{_basePath}/";
        Console.WriteLine($"[R2Storage] Initialized - Bucket: {_bucketName}, BasePath: {pathInfo}, URL: {_publicUrlBase}");
    }
    
    /// <summary>
    /// Lazy bucket verification - only checks on first upload
    /// </summary>
    private async Task EnsureBucketAccessAsync()
    {
        if (_bucketVerified) return;
        
        lock (_verifyLock)
        {
            if (_bucketVerified) return;
            _bucketVerified = true; // Set immediately to avoid repeated attempts
        }
        
        try
        {
            await _s3Client.ListObjectsV2Async(new ListObjectsV2Request
            {
                BucketName = _bucketName,
                MaxKeys = 1
            });
            Console.WriteLine($"[R2Storage] Bucket '{_bucketName}' verified accessible");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[R2Storage] WARNING: Bucket access check failed: {ex.Message}");
            // Don't throw - let the actual upload fail with a better error
        }
        
        // Configure CORS on the R2 bucket so browsers can load videos directly
        // This is a belt-and-suspenders approach: nginx proxy handles most requests,
        // but direct R2 access (e.g., from players or cached URLs) also needs CORS.
        await EnsureCorsConfiguredAsync();
    }
    
    /// <summary>
    /// Configures CORS on the R2 bucket via the S3-compatible PutBucketCors API.
    /// This runs once on startup and is idempotent — it overwrites any existing CORS config
    /// with the authoritative set of allowed origins from appsettings/environment.
    /// </summary>
    private async Task EnsureCorsConfiguredAsync()
    {
        try
        {
            var corsConfiguration = new CORSConfiguration
            {
                Rules = new List<CORSRule>
                {
                    new CORSRule
                    {
                        AllowedOrigins = _corsAllowedOrigins.ToList(),
                        AllowedMethods = new List<string> { "GET", "HEAD" },
                        AllowedHeaders = new List<string> { "*" },
                        MaxAgeSeconds = 86400 // Cache preflight for 24 hours
                    }
                }
            };
            
            await _s3Client.PutCORSConfigurationAsync(new PutCORSConfigurationRequest
            {
                BucketName = _bucketName,
                Configuration = corsConfiguration
            });
            
            Console.WriteLine($"[R2Storage] CORS configured for bucket '{_bucketName}' — allowed origins: {string.Join(", ", _corsAllowedOrigins)}");
        }
        catch (Exception ex)
        {
            // CORS config failure is non-fatal — the nginx proxy will still serve 
            // videos to the frontend. Log a warning so operators can investigate.
            Console.WriteLine($"[R2Storage] WARNING: Failed to configure CORS on bucket: {ex.Message}");
        }
    }

    public async Task<string> UploadFileAsync(
        Stream fileStream, 
        string fileName, 
        string contentType,
        CancellationToken cancellationToken = default)
    {
        // Lazy bucket verification on first upload
        await EnsureBucketAccessAsync();
        
        // Use the fileName as the object key (preserves directory structure)
        // If fileName already contains path (e.g., "Screens/xxx/image.png"), use it as-is
        // Otherwise, generate a unique key with the original extension
        string objectKey;
        if (fileName.Contains('/') || fileName.Contains('\\'))
        {
            // Path provided - use as object key (normalize slashes)
            objectKey = fileName.Replace('\\', '/');
        }
        else
        {
            // No path provided - generate unique key
            var fileExtension = Path.GetExtension(fileName);
            objectKey = $"{Guid.NewGuid()}{fileExtension}";
        }
        
        // Prepend base path if configured (e.g., "uploads/Screens/xxx/image.png")
        if (!string.IsNullOrEmpty(_basePath))
        {
            objectKey = $"{_basePath}/{objectKey}";
        }
        
        // Copy stream to MemoryStream to get the content length
        // This is required because R2 needs Content-Length header
        using var memoryStream = new MemoryStream();
        await fileStream.CopyToAsync(memoryStream, cancellationToken);
        memoryStream.Position = 0;
        
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

/// <summary>
/// Custom HttpClientFactory to configure TLS for Cloudflare R2 compatibility
/// </summary>
internal class R2HttpClientFactory : Amazon.Runtime.HttpClientFactory
{
    private readonly HttpClientHandler _handler;

    public R2HttpClientFactory(HttpClientHandler handler)
    {
        _handler = handler;
    }

    public override HttpClient CreateHttpClient(IClientConfig clientConfig)
    {
        return new HttpClient(_handler, disposeHandler: false);
    }
}
