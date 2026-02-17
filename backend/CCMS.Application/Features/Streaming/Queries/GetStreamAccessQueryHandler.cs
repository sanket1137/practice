using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CCMS.Application.Features.Streaming.Queries;

/// <summary>
/// Handler for GetStreamAccessQuery - validates user permission to view screen stream
/// </summary>
public class GetStreamAccessQueryHandler : IRequestHandler<GetStreamAccessQuery, bool>
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<Booking> _bookingRepository;
    private readonly ILogger<GetStreamAccessQueryHandler> _logger;

    public GetStreamAccessQueryHandler(
        IRepository<Screen> screenRepository,
        IRepository<User> userRepository,
        IRepository<Booking> bookingRepository,
        ILogger<GetStreamAccessQueryHandler> logger)
    {
        _screenRepository = screenRepository;
        _userRepository = userRepository;
        _bookingRepository = bookingRepository;
        _logger = logger;
    }

    public async Task<bool> Handle(GetStreamAccessQuery request, CancellationToken cancellationToken)
    {
        try
        {
            // Parse Guid IDs
            if (!Guid.TryParse(request.UserId, out var userId))
            {
                _logger.LogWarning("Invalid UserId format: {UserId}", request.UserId);
                return false;
            }
            
            if (!Guid.TryParse(request.ScreenId, out var screenId))
            {
                _logger.LogWarning("Invalid ScreenId format: {ScreenId}", request.ScreenId);
                return false;
            }

            // Get user
            var user = await _userRepository.GetByIdAsync(userId, cancellationToken);
            if (user == null)
            {
                _logger.LogWarning("User {UserId} not found", request.UserId);
                return false;
            }

            // Admins can view all streams
            if (user.Role == UserRole.Admin)
            {
                _logger.LogInformation("Admin user {UserId} granted access to stream for screen {ScreenId}", 
                    request.UserId, request.ScreenId);
                return true;
            }

            // Get screen
            var screen = await _screenRepository.GetByIdAsync(screenId, cancellationToken);
            if (screen == null)
            {
                _logger.LogWarning("Screen {ScreenId} not found", request.ScreenId);
                return false;
            }

            // Check if user is the screen owner
            if (user.Role == UserRole.ScreenOwner && screen.OwnerId == userId)
            {
                _logger.LogInformation("Screen owner {UserId} granted access to stream for their screen {ScreenId}", 
                    request.UserId, request.ScreenId);
                return true;
            }

            // Check if user is an advertiser with an active booking on this screen
            // Note: For MVP, we're checking for ANY active booking by the advertiser on this screen
            // In a full implementation, we'd verify campaign ownership through Campaign navigation
            if (user.Role == UserRole.Advertiser)
            {
                var now = DateTime.UtcNow;
                var nowDate = DateOnly.FromDateTime(now);
                
                // Get all active bookings for this screen
                var activeBookings = await _bookingRepository.FindAsync(
                    b => b.ScreenId == screenId && 
                         b.Status == BookingStatus.Approved &&
                         b.StartDate <= nowDate &&
                         b.EndDate >= nowDate,
                    cancellationToken);

                if (activeBookings.Any())
                {
                    _logger.LogInformation(
                        "Advertiser {UserId} granted access to stream for screen {ScreenId} (has active bookings)", 
                        request.UserId, request.ScreenId);
                    return true;
                }
            }

            _logger.LogWarning(
                "Access denied for user {UserId} (Role: {Role}) to view stream for screen {ScreenId}", 
                request.UserId, user.Role, request.ScreenId);
            
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, 
                "Error checking stream access for user {UserId} on screen {ScreenId}", 
                request.UserId, request.ScreenId);
            return false;
        }
    }
}
