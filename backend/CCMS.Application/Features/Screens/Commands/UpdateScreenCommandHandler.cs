using AutoMapper;
using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Screens;
using CCMS.Application.Interfaces;

namespace CCMS.Application.Features.Screens.Commands;

public class UpdateScreenCommandHandler : IRequestHandler<UpdateScreenCommand, ScreenDto>
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly IRevenueCalculationService _revenueCalculationService;
    private readonly IScreenNotificationService _screenNotificationService;

    public UpdateScreenCommandHandler(
        IRepository<Screen> screenRepository,
        IUnitOfWork unitOfWork,
        IMapper mapper,
        IRevenueCalculationService revenueCalculationService,
        IScreenNotificationService screenNotificationService)
    {
        _screenRepository = screenRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _revenueCalculationService = revenueCalculationService;
        _screenNotificationService = screenNotificationService;
    }

    public async Task<ScreenDto> Handle(UpdateScreenCommand request, CancellationToken cancellationToken)
    {
        var screen = await _screenRepository.GetByIdAsync(request.ScreenId, cancellationToken);
        if (screen == null)
            throw new InvalidOperationException($"Screen {request.ScreenId} not found");

        // Verify ownership (only owner or admin can update)
        if (screen.OwnerId != request.UserId)
            throw new UnauthorizedAccessException("You do not have permission to update this screen");

        // Update only provided fields
        if (request.Request.Name != null)
            screen.Name = request.Request.Name;
        if (request.Request.Description != null)
            screen.Description = request.Request.Description;
        if (request.Request.PhysicalWidth.HasValue)
            screen.PhysicalWidth = request.Request.PhysicalWidth.Value;
        if (request.Request.PhysicalHeight.HasValue)
            screen.PhysicalHeight = request.Request.PhysicalHeight.Value;
        if (request.Request.ResolutionWidth.HasValue)
            screen.ResolutionWidth = request.Request.ResolutionWidth.Value;
        if (request.Request.ResolutionHeight.HasValue)
            screen.ResolutionHeight = request.Request.ResolutionHeight.Value;
        if (request.Request.Location != null)
            screen.Location = _mapper.Map<Domain.ValueObjects.Address>(request.Request.Location);
        if (request.Request.Latitude.HasValue || request.Request.Longitude.HasValue)
        {
            // Latitude and Longitude are on Screen, not Location
            if (request.Request.Latitude.HasValue)
                screen.Latitude = request.Request.Latitude.Value;
            if (request.Request.Longitude.HasValue)
                screen.Longitude = request.Request.Longitude.Value;
        }
        if (request.Request.Schedule != null)
            screen.Schedule = _mapper.Map<Domain.ValueObjects.OperatingSchedule>(request.Request.Schedule);
        if (request.Request.TimeFrameMinutes.HasValue)
            screen.TimeFrameMinutes = request.Request.TimeFrameMinutes.Value;
        if (request.Request.SlotsPerFrame.HasValue)
            screen.SlotsPerFrame = request.Request.SlotsPerFrame.Value;

        // Validate even-division: frame time (seconds) must divide evenly by slots.
        // FluentValidation handles the case where both fields are in the request.
        // Here we handle partial updates where only one field changed
        // (the other comes from the current DB entity — already applied above).
        if (screen.TimeFrameMinutes > 0 && screen.SlotsPerFrame > 0)
        {
            var totalSeconds = screen.TimeFrameMinutes * 60;
            if (totalSeconds % screen.SlotsPerFrame != 0)
            {
                var slotSec = totalSeconds / (double)screen.SlotsPerFrame;
                throw new InvalidOperationException(
                    $"Frame time ({screen.TimeFrameMinutes} min = {totalSeconds}s) must divide evenly by " +
                    $"{screen.SlotsPerFrame} slots. Current slot duration would be {slotSec:F2}s — must be a whole number of seconds.");
            }
        }

        if (request.Request.PricePerSlot.HasValue)
            screen.PricePerSlot = request.Request.PricePerSlot.Value;

        // Screen status is deliberately NOT writable here. The old free-form
        // Enum.Parse write was the lifecycle bypass that let a screen become
        // "Active" with no verification and no device — status now changes only
        // through ScreenLifecycleService's guarded transitions. Older clients
        // may still send the field; it is ignored, not rejected, so cached
        // frontends keep working.

        if (request.Request.ScreenType != null)
        {
            if (!Enum.TryParse<Domain.Enums.ScreenType>(request.Request.ScreenType, ignoreCase: true, out var screenType))
                throw new InvalidOperationException($"Unknown screen type '{request.Request.ScreenType}'.");
            screen.ScreenType = screenType;
        }

        if (request.Request.VenueType != null)
        {
            if (!Enum.TryParse<Domain.Enums.VenueType>(request.Request.VenueType, ignoreCase: true, out var venueType))
                throw new InvalidOperationException($"Unknown venue type '{request.Request.VenueType}'.");
            screen.VenueType = venueType;
        }
        if (request.Request.PixelPitchMm.HasValue)
            screen.PixelPitchMm = request.Request.PixelPitchMm.Value;

        if (request.Request.DimensionUnit != null)
        {
            var unit = Domain.ValueObjects.DimensionUnits.Normalize(request.Request.DimensionUnit);
            if (unit == null)
                throw new InvalidOperationException(
                    $"Unsupported dimension unit '{request.Request.DimensionUnit}'. Use one of: {string.Join(", ", Domain.ValueObjects.DimensionUnits.Supported)}.");
            screen.DimensionUnit = unit;
        }

        // Keep the canonical millimetre columns in step whenever size or unit moved.
        if (request.Request.PhysicalWidth.HasValue || request.Request.PhysicalHeight.HasValue || request.Request.DimensionUnit != null)
        {
            screen.PhysicalWidthMm = Domain.ValueObjects.DimensionUnits.ToMillimeters(screen.PhysicalWidth, screen.DimensionUnit);
            screen.PhysicalHeightMm = Domain.ValueObjects.DimensionUnits.ToMillimeters(screen.PhysicalHeight, screen.DimensionUnit);
        }

        if (!string.IsNullOrEmpty(request.Request.Timezone))
            screen.Timezone = request.Request.Timezone;

        screen.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var screenDto = _mapper.Map<ScreenDto>(screen);
        screenDto.RevenueEstimate = _revenueCalculationService.CalculateRevenueEstimate(screen);

        return screenDto;
    }
}
