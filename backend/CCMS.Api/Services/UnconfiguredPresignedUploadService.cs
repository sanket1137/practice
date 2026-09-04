using CCMS.Application.Interfaces;

namespace CCMS.Api.Services;

/// <summary>
/// Stand-in for <see cref="IPresignedUploadService"/> on machines with no R2
/// configuration (local-storage dev). Lets the API boot; any feature that
/// actually needs presigned direct uploads fails with a clear message
/// instead of a mangled R2 endpoint at startup.
/// </summary>
public class UnconfiguredPresignedUploadService : IPresignedUploadService
{
    private static InvalidOperationException NotConfigured()
        => new("Presigned uploads are unavailable: R2 storage is not configured (set R2:AccountId / R2:AccessKey / R2:SecretKey).");

    public string GetPresignedUploadUrl(string objectKey, string contentType, TimeSpan expiry)
        => throw NotConfigured();

    public string GetPublicUrl(string objectKey)
        => throw NotConfigured();

    public Task<bool> ObjectExistsAsync(string objectKey, CancellationToken cancellationToken = default)
        => throw NotConfigured();
}
