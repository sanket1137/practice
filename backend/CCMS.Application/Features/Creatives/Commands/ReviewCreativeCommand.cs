using MediatR;
using CCMS.Domain.Enums;
using CCMS.Shared.DTOs.Creatives;

namespace CCMS.Application.Features.Creatives.Commands;

public class ReviewCreativeCommand : IRequest<CreativeDto>
{
    public Guid CreativeId { get; set; }
    public Guid ReviewedByUserId { get; set; }
    public CreativeStatus NewStatus { get; set; }
    public string? ReviewNotes { get; set; }
}

public class BulkApproveCreativesCommand : IRequest<int>
{
    public List<Guid> CreativeIds { get; set; } = new();
    public Guid ReviewedByUserId { get; set; }
}
