using AutoMapper;
using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Screens;
using CCMS.Application.Interfaces;

namespace CCMS.Application.Features.Screens.Queries;

public class GetScreenByIdQueryHandler : IRequestHandler<GetScreenByIdQuery, ScreenDto?>
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly IScreenImageService _screenImageService;
    private readonly IRevenueCalculationService _revenueCalculationService;
    private readonly IMapper _mapper;

    public GetScreenByIdQueryHandler(
        IRepository<Screen> screenRepository,
        IScreenImageService screenImageService,
        IRevenueCalculationService revenueCalculationService,
        IMapper mapper)
    {
        _screenRepository = screenRepository;
        _screenImageService = screenImageService;
        _revenueCalculationService = revenueCalculationService;
        _mapper = mapper;
    }

    public async Task<ScreenDto?> Handle(GetScreenByIdQuery request, CancellationToken cancellationToken)
    {
        var screen = await _screenRepository.GetByIdAsync(request.ScreenId, cancellationToken);
        if (screen == null)
        {
            return null;
        }
        
        var screenDto = _mapper.Map<ScreenDto>(screen);
        
        // Calculate revenue estimate with slot/frame breakdown
        screenDto.RevenueEstimate = _revenueCalculationService.CalculateRevenueEstimate(screen);
        
        // Fetch images separately since the repository doesn't include them
        var images = await _screenImageService.GetImagesAsync(request.ScreenId, cancellationToken);
        screenDto.Images = images;
        screenDto.PrimaryImage = images.FirstOrDefault(i => i.IsPrimary);
        
        return screenDto;
    }
}
