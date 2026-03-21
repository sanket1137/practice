using CCMS.Shared.DTOs.Creatives;
using MediatR;

namespace CCMS.Application.Features.Creatives.Commands;

public class UploadCreativeCommand : IRequest<CreativeDto>
{
    public Guid? CampaignId { get; set; }
    public Guid UserId { get; set; }
    public Stream FileStream { get; set; } = null!;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Duration { get; set; }
    public int? Width { get; set; }  // Nullable - if provided, overrides auto-detection
    public int? Height { get; set; } // Nullable - if provided, overrides auto-detection
}
