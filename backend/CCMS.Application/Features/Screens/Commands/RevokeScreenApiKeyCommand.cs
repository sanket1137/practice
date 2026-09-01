using MediatR;
using CCMS.Domain.Interfaces;
using CCMS.Domain.Entities;

namespace CCMS.Application.Features.Screens.Commands;

public class RevokeScreenApiKeyCommand : IRequest<Unit>
{
    public Guid ScreenId { get; set; }
}

public class RevokeScreenApiKeyCommandHandler : IRequestHandler<RevokeScreenApiKeyCommand, Unit>
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly IUnitOfWork _unitOfWork;

    public RevokeScreenApiKeyCommandHandler(
        IRepository<Screen> screenRepository,
        IUnitOfWork unitOfWork)
    {
        _screenRepository = screenRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<Unit> Handle(RevokeScreenApiKeyCommand request, CancellationToken cancellationToken)
    {
        var screen = await _screenRepository.GetByIdAsync(request.ScreenId);
        if (screen == null)
        {
            throw new KeyNotFoundException($"Screen {request.ScreenId} not found");
        }

        // Revocation kills everything — including a rotated-out key still inside
        // its grace window. Grace exists for planned rotations, never revokes.
        screen.ApiKeyHash = null;
        screen.ApiKeyHashPrevious = null;
        screen.ApiKeyRotatedAt = null;
        await _screenRepository.UpdateAsync(screen);
        await _unitOfWork.SaveChangesAsync();

        return Unit.Value;
    }
}
