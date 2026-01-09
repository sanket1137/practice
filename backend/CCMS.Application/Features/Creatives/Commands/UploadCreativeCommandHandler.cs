using System.Security.Cryptography;
using AutoMapper;
using CCMS.Application.Interfaces;
using CCMS.Application.Services;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Creatives;
using MediatR;

namespace CCMS.Application.Features.Creatives.Commands;

public class UploadCreativeCommandHandler : IRequestHandler<UploadCreativeCommand, CreativeDto>
{
    private readonly IRepository<Creative> _creativeRepository;
    private readonly IRepository<Campaign> _campaignRepository;
    private readonly IFileStorageService _fileStorageService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly VideoMetadataService _videoMetadataService;

    public UploadCreativeCommandHandler(
        IRepository<Creative> creativeRepository,
        IRepository<Campaign> campaignRepository,
        IFileStorageService fileStorageService,
        IUnitOfWork unitOfWork,
        IMapper mapper,
        VideoMetadataService videoMetadataService)
    {
        _creativeRepository = creativeRepository;
        _campaignRepository = campaignRepository;
        _fileStorageService = fileStorageService;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _videoMetadataService = videoMetadataService;
    }

    public async Task<CreativeDto> Handle(UploadCreativeCommand request, CancellationToken cancellationToken)
    {
        // Verify campaign exists and user owns it
        var campaign = await _campaignRepository.GetByIdAsync(request.CampaignId, cancellationToken);
        if (campaign == null)
            throw new KeyNotFoundException("Campaign not found");

        if (campaign.AdvertiserId != request.UserId)
            throw new UnauthorizedAccessException("You can only upload creatives to your own campaigns");

        // Extract video metadata BEFORE upload
        CreativeMetadata metadata; // Changed from VideoMetadata to CreativeMetadata
        try
        {
            // Ensure stream is at beginning
            request.FileStream.Position = 0;
            
            metadata = await _videoMetadataService.ExtractMetadataAsync(request.FileStream, request.FileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to extract metadata for {FileName}", request.FileName); // Added logging
            // Fallback to default metadata
            metadata = new CreativeMetadata // Changed from VideoMetadata to CreativeMetadata
            {
                Duration = 30,
                Width = 1920,
                Height = 1080
            };
        }
        
        // Validate file size and duration limits
        const long MAX_FILE_SIZE = 2_147_483_648; // 2 GB
        const int MAX_DURATION_SECONDS = 160; // 2 min 40 sec

        // Check file size
        if (request.FileStream.Length > MAX_FILE_SIZE)
        {
            var fileSizeGB = request.FileStream.Length / 1024.0 / 1024.0 / 1024.0;
            throw new InvalidOperationException(
                $"File size exceeds maximum limit. " +
                $"Maximum: 2 GB, " +
                $"Your file: {fileSizeGB:F2} GB. " +
                $"Please compress or trim your video.");
        }

        // Check duration
        if (metadata.Duration > MAX_DURATION_SECONDS)
        {
            var minutes = metadata.Duration / 60;
            var seconds = metadata.Duration % 60;
            throw new InvalidOperationException(
                $"Video duration exceeds maximum limit. " +
                $"Maximum: 2 minutes 40 seconds (160s), " +
                $"Your video: {minutes}m {seconds}s ({metadata.Duration}s). " +
                $"Please trim your video.");
        }
        // Upload file to storage
        string fileUrl;
        string fileHash;
        
        using (var stream = request.FileStream)
        {
            // ✅ CRITICAL: Reset stream position after metadata extraction
            stream.Position = 0;
            
            fileUrl = await _fileStorageService.UploadFileAsync(
                stream,
                request.FileName,
                request.ContentType);

            // Calculate file hash for integrity
            stream.Position = 0;
            using var sha256 = SHA256.Create();
            var hashBytes = await sha256.ComputeHashAsync(stream, cancellationToken);
            fileHash = Convert.ToBase64String(hashBytes);
        }

        // Create creative entity
        var creative = new Creative
        {
            CampaignId = request.CampaignId,
            Name = request.Name,
            FileUrl = fileUrl,
            FileName = request.FileName,
            MimeType = request.ContentType,
            FileSize = request.FileSize,
            FileHash = fileHash,
            Duration = metadata.Duration,  // ✅ From video file, not user!
            Width = metadata.Width,        // ✅ From video file, not user!
            Height = metadata.Height,      // ✅ From video file, not user!
            CreatedAt = DateTime.UtcNow
        };

        await _creativeRepository.AddAsync(creative, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<CreativeDto>(creative);
    }
}
