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

        var statusChanged = false;
        if (request.Request.Status != null)
        {
            var newStatus = Enum.Parse<Domain.Enums.ScreenStatus>(request.Request.Status);
            statusChanged = screen.Status != newStatus;
            screen.Status = newStatus;
        }
        if (!string.IsNullOrEmpty(request.Request.Timezone))
            screen.Timezone = request.Request.Timezone;

        screen.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Broadcast after persistence so dashboards never learn about a state
        // that failed to save. Best-effort inside the service — a broadcast
        // failure never fails the update.
        if (statusChanged)
        {
            await _screenNotificationService.NotifyScreenStatusChangedAsync(
                screen.Id, screen.Status.ToString(), cancellationToken);
        }

        var screenDto = _mapper.Map<ScreenDto>(screen);
        screenDto.RevenueEstimate = _revenueCalculationService.CalculateRevenueEstimate(screen);

        return screenDto;
    }
}
