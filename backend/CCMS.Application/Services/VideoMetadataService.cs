using Xabe.FFmpeg;

namespace CCMS.Application.Services;

public class VideoMetadataService
{
    /// <summary>
    /// Extract video metadata (duration, width, height) from video file
    /// </summary>
    public async Task<VideoMetadata> ExtractMetadataAsync(Stream videoStream, string fileName)
    {
        // Save stream to temp file (FFmpeg requires file path)
        var tempPath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}_{fileName}");
        
        try
        {
            // Write stream to temp file
            using (var fileStream = File.Create(tempPath))
            {
                videoStream.Position = 0;
                await videoStream.CopyToAsync(fileStream);
            }

            // Extract metadata using FFmpeg
            var mediaInfo = await FFmpeg.GetMediaInfo(tempPath);
            var video = mediaInfo.VideoStreams.FirstOrDefault();

            if (video == null)
            {
                throw new InvalidOperationException("No video stream found in file");
            }

            return new VideoMetadata
            {
                Duration = (int)mediaInfo.Duration.TotalSeconds,
                Width = video.Width,
                Height = video.Height,
                FrameRate = video.Framerate,
                Bitrate = video.Bitrate
            };
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
