namespace CCMS.Application.Interfaces;

/// <summary>
/// Generates short-lived signed URLs that let the browser upload directly to
/// object storage (R2) without going through the API. Optional — only the R2
/// backend implements this; local dev fallback routes uploads through the API.
/// </summary>
public interface IPresignedUploadService
{
    /// <summary>
    /// Returns a URL the client can PUT to for the given object key.
    /// </summary>
    /// <param name="objectKey">Full key inside the bucket (including any base path).</param>
    /// <param name="contentType">MIME type the client will send.</param>
    /// <param name="expiry">How long the signed URL is valid.</param>
    string GetPresignedUploadUrl(string objectKey, string contentType, TimeSpan expiry);

    /// <summary>Public URL that resolves to the finalized object once uploaded.</summary>
    string GetPublicUrl(string objectKey);

    /// <summary>Verify the object actually landed in storage (before we mark IsReady).</summary>
    Task<bool> ObjectExistsAsync(string objectKey, CancellationToken cancellationToken = default);
}
