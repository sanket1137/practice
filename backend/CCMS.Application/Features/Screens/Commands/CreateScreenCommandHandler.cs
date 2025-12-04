using AutoMapper;
using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Features.Screens.Commands;

public class CreateScreenCommandHandler : IRequestHandler<CreateScreenCommand, ScreenDto>
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    public CreateScreenCommandHandler(
        IRepository<Screen> screenRepository,
        IUnitOfWork unitOfWork,
        IMapper mapper)
    {
        _screenRepository = screenRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<ScreenDto> Handle(CreateScreenCommand request, CancellationToken cancellationToken)
    {
        var screen = _mapper.Map<Screen>(request.Request);
        screen.OwnerId = request.UserId;

        await _screenRepository.AddAsync(screen, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<ScreenDto>(screen);
    }
}
