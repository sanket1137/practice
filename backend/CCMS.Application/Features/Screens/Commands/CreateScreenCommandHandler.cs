using AutoMapper;
using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Domain.ValueObjects;
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

        // Screens are born Draft — invisible to the marketplace and players
        // until they pass verification and the owner explicitly activates them
        // (ScreenLifecycleService owns every later status change). The entity
        // default matches, but stating it here keeps the rule greppable.
        screen.Status = ScreenStatus.Draft;

        // Normalize the entered unit, parse the asset type, and compute the
        // canonical millimetre dimensions every search/sort must use.
        var unit = DimensionUnits.Normalize(request.Request.DimensionUnit);
        if (unit == null)
            throw new InvalidOperationException(
                $"Unsupported dimension unit '{request.Request.DimensionUnit}'. Use one of: {string.Join(", ", DimensionUnits.Supported)}.");
        screen.DimensionUnit = unit;
        screen.PhysicalWidthMm = DimensionUnits.ToMillimeters(screen.PhysicalWidth, unit);
        screen.PhysicalHeightMm = DimensionUnits.ToMillimeters(screen.PhysicalHeight, unit);

        if (!string.IsNullOrWhiteSpace(request.Request.ScreenType))
        {
            if (!Enum.TryParse<ScreenType>(request.Request.ScreenType, ignoreCase: true, out var screenType))
                throw new InvalidOperationException($"Unknown screen type '{request.Request.ScreenType}'.");
            screen.ScreenType = screenType;
        }
        screen.PixelPitchMm = request.Request.PixelPitchMm;

        await _screenRepository.AddAsync(screen, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var screenDto = _mapper.Map<ScreenDto>(screen);
        
        // Calculate and include revenue estimate
        screenDto.RevenueEstimate = _revenueCalculationService.CalculateRevenueEstimate(screen);

        return screenDto;
    }
}
