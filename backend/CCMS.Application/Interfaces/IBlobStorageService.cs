namespace CCMS.Application.Interfaces;

public interface IBlobStorageService
{
    Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType);
    Task DeleteFileAsync(string fileUrl);
    Task<Stream> DownloadFileAsync(string fileUrl);
}
