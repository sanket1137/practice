using MediatR;
using CCMS.Shared.DTOs.Creatives;

namespace CCMS.Application.Features.Creatives.Queries;

public class GetAdminCreativesQuery : IRequest<IEnumerable<AdminCreativeDto>>
{
    public string Status { get; set; } = "PendingReview";
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
