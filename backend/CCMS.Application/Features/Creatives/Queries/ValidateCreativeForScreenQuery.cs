using MediatR;
using CCMS.Shared.DTOs.Creatives;

namespace CCMS.Application.Features.Creatives.Queries;

public class ValidateCreativeForScreenQuery : IRequest<CreativeValidationDto>
{
    public Guid CreativeId { get; set; }
    public Guid ScreenId { get; set; }
}
