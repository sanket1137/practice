using MediatR;
using CCMS.Domain.Interfaces;
using CCMS.Domain.Entities;

namespace CCMS.Application.Features.Screens.Commands;

public class UpdateScreenApiKeyCommand : IRequest<Unit>
{
    public Guid ScreenId { get; set; }
    public string ApiKeyHash { get; set; } = string.Empty;
}

public class UpdateScreenApiKeyCommandHandler : IRequestHandler<UpdateScreenApiKeyCommand, Unit>
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateScreenApiKeyCommandHandler(
        IRepository<Screen> screenRepository,
        IUnitOfWork unitOfWork)
    {
        _screenRepository = screenRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<Unit> Handle(UpdateScreenApiKeyCommand request, CancellationToken cancellationToken)
    {
        var screen = await _screenRepository.GetByIdAsync(request.ScreenId);
        if (screen == null)
        {
            throw new KeyNotFoundException($"Screen {request.ScreenId} not found");
        }

        screen.ApiKeyHash = request.ApiKeyHash;
        await _screenRepository.UpdateAsync(screen);
        await _unitOfWork.SaveChangesAsync();

        return Unit.Value;
    }
}
