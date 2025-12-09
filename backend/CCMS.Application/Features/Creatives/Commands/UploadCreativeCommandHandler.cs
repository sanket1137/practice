using System.Security.Cryptography;
using AutoMapper;
using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Creatives;
using MediatR;

namespace CCMS.Application.Features.Creatives.Commands;

public class UploadCreativeCommandHandler : IRequestHandler<UploadCreativeCommand, CreativeDto>
{
    private readonly IRepository<Creative> _creativeRepository;
    private readonly IRepository<Campaign> _campaignRepository;
    private readonly IBlobStorageService _blobStorageService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    public UploadCreativeCommandHandler(
        IRepository<Creative> creativeRepository,
        IRepository<Campaign> campaignRepository,
        IBlobStorageService blobStorageService,
        IUnitOfWork unitOfWork,
        IMapper mapper)
    {
        _creativeRepository = creativeRepository;
        _campaignRepository = campaignRepository;
        _blobStorageService = blobStorageService;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<CreativeDto> Handle(UploadCreativeCommand request, CancellationToken cancellationToken)
    {
        // Verify campaign exists and user owns it
        var campaign = await _campaignRepository.GetByIdAsync(request.CampaignId, cancellationToken);
        if (campaign == null)
            throw new KeyNotFoundException("Campaign not found");

        if (campaign.AdvertiserId != request.UserId)
            throw new UnauthorizedAccessException("You can only upload creatives to your own campaigns");

        // Upload file to blob storage
        string fileUrl;
        string fileHash;
        
        using (var stream = request.FileStream)
        {
            fileUrl = await _blobStorageService.UploadFileAsync(
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
            Duration = request.Duration,
            Width = 0, // You can extract from image/video metadata if needed
            Height = 0,
            CreatedAt = DateTime.UtcNow
        };

        await _creativeRepository.AddAsync(creative, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<CreativeDto>(creative);
    }
}
