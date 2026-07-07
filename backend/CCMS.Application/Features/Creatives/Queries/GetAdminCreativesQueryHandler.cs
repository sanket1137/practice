using MediatR;
using CCMS.Application.Helpers;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Creatives;

namespace CCMS.Application.Features.Creatives.Queries;

public class GetAdminCreativesQueryHandler : IRequestHandler<GetAdminCreativesQuery, IEnumerable<AdminCreativeDto>>
{
    private readonly IRepository<Creative> _creativeRepository;
    private readonly IRepository<User> _userRepository;

    public GetAdminCreativesQueryHandler(
        IRepository<Creative> creativeRepository,
        IRepository<User> userRepository)
    {
        _creativeRepository = creativeRepository;
        _userRepository = userRepository;
    }

    public async Task<IEnumerable<AdminCreativeDto>> Handle(GetAdminCreativesQuery request, CancellationToken cancellationToken)
    {
        var statusFilter = Enum.TryParse<CreativeStatus>(request.Status, out var parsedStatus)
            ? parsedStatus
            : CreativeStatus.PendingReview;

        var allCreatives = await _creativeRepository.FindAsync(c => !c.IsDeleted && c.Status == statusFilter, cancellationToken);

        var creatives = allCreatives
            .OrderBy(c => c.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToList();

        // Batch-load uploaders
        var uploaderIds = creatives
            .Where(c => c.UploadedById.HasValue)
            .Select(c => c.UploadedById!.Value)
            .Distinct()
            .ToList();

        var uploaders = new Dictionary<Guid, User>();
        foreach (var uid in uploaderIds)
        {
            var user = await _userRepository.GetByIdAsync(uid, cancellationToken);
            if (user != null)
                uploaders[uid] = user;
        }

        return creatives.Select(c =>
        {
            var uploader = c.UploadedById.HasValue && uploaders.TryGetValue(c.UploadedById.Value, out var u) ? u : null;
            return new AdminCreativeDto
            {
                Id = c.Id,
                CampaignId = c.CampaignId,
                Name = c.Name,
                FileName = c.FileName,
                FileUrl = c.FileUrl,
                ThumbnailUrl = c.ThumbnailUrl,
                MimeType = c.MimeType,
                FileSize = c.FileSize,
                Width = c.Width,
                Height = c.Height,
                Duration = c.Duration,
                Status = c.Status.ToString(),
                ReviewNotes = c.ReviewNotes,
                ReviewedAt = c.ReviewedAt,
                UploadedById = c.UploadedById,
                UploaderName = uploader != null ? $"{uploader.FirstName} {uploader.LastName}".Trim() : null,
                UploaderEmail = uploader?.Email,
                CreatedAt = c.CreatedAt
            };
        });
    }
}
