using Xabe.FFmpeg;
using Microsoft.Extensions.Logging;

namespace CCMS.Application.Services;

public class VideoMetadataService
{
    private readonly ILogger<VideoMetadataService> _logger;

    public VideoMetadataService(ILogger<VideoMetadataService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Extract video metadata (duration, width, height) from video file
    /// </summary>
    public async Task<VideoMetadata> ExtractMetadataAsync(Stream videoStream, string fileName)
    {
        _logger.LogInformation("Starting metadata extraction for file: {FileName}", fileName);
        
        // Save stream to temp file (FFmpeg requires file path)
        var tempPath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}_{fileName}");
        
        try
        {
            _logger.LogDebug("Writing video to temp file: {TempPath}", tempPath);
            
            // Write stream to temp file
            using (var fileStream = File.Create(tempPath))
            {
                videoStream.Position = 0;
                await videoStream.CopyToAsync(fileStream);
            }

            _logger.LogDebug("Extracting metadata using FFmpeg...");
            
            // Extract metadata using FFmpeg
            var mediaInfo = await FFmpeg.GetMediaInfo(tempPath);
            var video = mediaInfo.VideoStreams.FirstOrDefault();

            if (video == null)
            {
                _logger.LogError("No video stream found in file: {FileName}", fileName);
                throw new InvalidOperationException("No video stream found in file");
            }

            var metadata = new VideoMetadata
            {
                Duration = (int)mediaInfo.Duration.TotalSeconds,
                Width = video.Width,
                Height = video.Height,
                FrameRate = video.Framerate,
                Bitrate = video.Bitrate
            };
            
            _logger.LogInformation(
                "Successfully extracted metadata for {FileName}: Duration={Duration}s, Resolution={Width}x{Height}",
                fileName, metadata.Duration, metadata.Width, metadata.Height);
            
            return metadata;
        }
        finally
        {
            // Clean up temp file
            if (File.Exists(tempPath))
            {
                File.Delete(tempPath);
            }
        }
    }
}

public class VideoMetadata
{
    public int Duration { get; set; }  // in seconds
    public int Width { get; set; }
    public int Height { get; set; }
    public double FrameRate { get; set; }
    public long Bitrate { get; set; }
}
