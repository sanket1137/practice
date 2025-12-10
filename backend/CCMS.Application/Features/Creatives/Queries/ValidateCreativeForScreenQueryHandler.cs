using MediatR;
using CCMS.Application.Services;
using CCMS.Shared.DTOs.Creatives;

namespace CCMS.Application.Features.Creatives.Queries;

public class ValidateCreativeForScreenQueryHandler : IRequestHandler<ValidateCreativeForScreenQuery, CreativeValidationDto>
{
    private readonly CreativeValidationService _validationService;

    public ValidateCreativeForScreenQueryHandler(CreativeValidationService validationService)
    {
        _validationService = validationService;
    }

    public async Task<CreativeValidationDto> Handle(ValidateCreativeForScreenQuery request, CancellationToken cancellationToken)
    {
        return await _validationService.ValidateCreativeForScreen(
            request.CreativeId,
            request.ScreenId,
            cancellationToken);
    }
}
