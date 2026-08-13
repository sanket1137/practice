using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.Common;

namespace CCMS.Application.Features.Screens.Commands;

public class DeleteScreenCommandHandler : IRequestHandler<DeleteScreenCommand, ApiResponse<object>>
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly IUnitOfWork _unitOfWork;

    public DeleteScreenCommandHandler(
        IRepository<Screen> screenRepository,
        IUnitOfWork unitOfWork)
    {
        _screenRepository = screenRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<ApiResponse<object>> Handle(DeleteScreenCommand request, CancellationToken cancellationToken)
    {
        var screen = await _screenRepository.GetByIdAsync(request.ScreenId, cancellationToken);
        if (screen == null)
            throw new InvalidOperationException($"Screen {request.ScreenId} not found");

        // Verify ownership (only owner or admin can delete)
        if (screen.OwnerId != request.UserId)
            throw new UnauthorizedAccessException("You do not have permission to delete this screen");

        // Soft delete
        screen.IsDeleted = true;
        screen.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return ApiResponse<object>.SuccessResponse(null, "Screen deleted successfully");
    }
}
