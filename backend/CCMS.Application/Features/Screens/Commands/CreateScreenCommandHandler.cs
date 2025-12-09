using AutoMapper;
using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Screens;
using CCMS.Application.Interfaces;

namespace CCMS.Application.Features.Screens.Commands;

public class CreateScreenCommandHandler : IRequestHandler<CreateScreenCommand, ScreenDto>
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly IRevenueCalculationService _revenueCalculationService;

    public CreateScreenCommandHandler(
        IRepository<Screen> screenRepository,
        IUnitOfWork unitOfWork,
        IMapper mapper,
        IRevenueCalculationService revenueCalculationService)
    {
        _screenRepository = screenRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _revenueCalculationService = revenueCalculationService;
    }

    public async Task<ScreenDto> Handle(CreateScreenCommand request, CancellationToken cancellationToken)
    {
        var screen = _mapper.Map<Screen>(request.Request);
        screen.OwnerId = request.UserId;

        await _screenRepository.AddAsync(screen, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var screenDto = _mapper.Map<ScreenDto>(screen);
        
        // Calculate and include revenue estimate
        screenDto.RevenueEstimate = _revenueCalculationService.CalculateRevenueEstimate(screen);

        return screenDto;
    }
}
