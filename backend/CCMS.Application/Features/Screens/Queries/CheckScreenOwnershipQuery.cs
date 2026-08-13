using MediatR;
using CCMS.Domain.Interfaces;
using CCMS.Domain.Entities;

namespace CCMS.Application.Features.Screens.Queries;

public class CheckScreenOwnershipQuery : IRequest<ScreenOwnershipResult>
{
    public Guid ScreenId { get; set; }
}

public class ScreenOwnershipResult
{
    public bool Exists { get; set; }
    public Guid? OwnerId { get; set; }
}

public class CheckScreenOwnershipQueryHandler : IRequestHandler<CheckScreenOwnershipQuery, ScreenOwnershipResult>
{
    private readonly IRepository<Screen> _screenRepository;

    public CheckScreenOwnershipQueryHandler(IRepository<Screen> screenRepository)
    {
        _screenRepository = screenRepository;
    }

    public async Task<ScreenOwnershipResult> Handle(CheckScreenOwnershipQuery request, CancellationToken cancellationToken)
    {
        var screen = await _screenRepository.GetByIdAsync(request.ScreenId);
        
        return new ScreenOwnershipResult
        {
            Exists = screen != null,
            OwnerId = screen?.OwnerId
        };
    }
}
