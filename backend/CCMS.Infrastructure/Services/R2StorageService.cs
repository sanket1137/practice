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
public class R2StorageService : IFileStorageService, IPresignedUploadService
{
    private readonly IAmazonS3 _s3Client;
    // Separate client for bucket-admin operations (PutBucketCors, etc.) using an
    // admin token. Falls back to _s3Client when admin creds are not configured
    // so dev environments with a single full-access token still work.
    private readonly IAmazonS3 _adminS3Client;
    private readonly bool _hasAdminCredentials;
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

        // Force AWS SigV4 for presigned URLs. Without this the SDK defaults to
        // SigV2 query-string signing (AWSAccessKeyId/Signature), which R2
        // rejects on preflight OPTIONS with 401 — stripping CORS headers and
        // breaking browser uploads. Must be set before any S3 client is built.
        Amazon.AWSConfigsS3.UseSignatureVersion4 = true;

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

        // Optional admin credentials used only for bucket-config operations
        // (PutBucketCors). Kept separate so the runtime token can stay scoped
        // to object-level permissions (principle of least privilege).
        var adminAccessKeyId = configuration["R2:AdminAccessKeyId"];
        var adminSecretAccessKey = configuration["R2:AdminSecretAccessKey"];
        if (!string.IsNullOrWhiteSpace(adminAccessKeyId) && !string.IsNullOrWhiteSpace(adminSecretAccessKey))
        {
            var adminConfig = new AmazonS3Config
            {
                ServiceURL = r2Endpoint,
                ForcePathStyle = true,
                SignatureVersion = "4",
                HttpClientFactory = new R2HttpClientFactory(httpClientHandler)
            };
            _adminS3Client = new AmazonS3Client(adminAccessKeyId, adminSecretAccessKey, adminConfig);
            _hasAdminCredentials = true;
        }
        else
        {
            _adminS3Client = _s3Client;
            _hasAdminCredentials = false;
        }
        
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

        // Configure CORS in the background on startup so browser-direct presigned
        // PUT uploads (CMS media uploader) don't fail with a preflight block.
        // Non-blocking: failures are logged and don't prevent the app from starting.
        _ = Task.Run(async () =>
        {
            try { await EnsureCorsConfiguredAsync(); }
            catch (Exception ex) { Console.WriteLine($"[R2Storage] Background CORS setup failed: {ex.Message}"); }
        });
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
                        // GET/HEAD for media playback; PUT/POST for browser-direct presigned
                        // uploads (CMS media library). DELETE reserved for future client-side cleanup.
                        AllowedMethods = new List<string> { "GET", "HEAD", "PUT", "POST", "DELETE" },
                        AllowedHeaders = new List<string> { "*" },
                        // ETag must be exposed so xhr.upload can read the upload fingerprint
                        // returned by R2 and confirm integrity before calling /finalize.
                        ExposeHeaders = new List<string> { "ETag" },
                        MaxAgeSeconds = 86400 // Cache preflight for 24 hours
                    }
                }
            };
            
            await _adminS3Client.PutCORSConfigurationAsync(new PutCORSConfigurationRequest
            {
                BucketName = _bucketName,
                Configuration = corsConfiguration
            });

            var tokenKind = _hasAdminCredentials ? "admin" : "runtime";
            Console.WriteLine($"[R2Storage] CORS configured for bucket '{_bucketName}' via {tokenKind} token — allowed origins: {string.Join(", ", _corsAllowedOrigins)}");
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

    // ── IPresignedUploadService ────────────────────────────────────────────

    public string GetPresignedUploadUrl(string objectKey, string contentType, TimeSpan expiry)
    {
        var fullKey = string.IsNullOrEmpty(_basePath) ? objectKey : $"{_basePath}/{objectKey}";
        var request = new GetPreSignedUrlRequest
        {
            BucketName = _bucketName,
            Key = fullKey,
            Expires = DateTime.UtcNow.Add(expiry),
            Verb = HttpVerb.PUT,
            ContentType = contentType
        };
        return _s3Client.GetPreSignedURL(request);
    }

    public string GetPublicUrl(string objectKey)
    {
        var fullKey = string.IsNullOrEmpty(_basePath) ? objectKey : $"{_basePath}/{objectKey}";
        return $"{_publicUrlBase}/{fullKey}";
    }

    public async Task<bool> ObjectExistsAsync(string objectKey, CancellationToken cancellationToken = default)
    {
        var fullKey = string.IsNullOrEmpty(_basePath) ? objectKey : $"{_basePath}/{objectKey}";
        try
        {
            await _s3Client.GetObjectMetadataAsync(_bucketName, fullKey, cancellationToken);
            return true;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return false;
        }
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
