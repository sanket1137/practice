using AutoMapper;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Bookings;
using MediatR;

namespace CCMS.Application.Features.Bookings.Queries;

public class GetBookingsQueryHandler : IRequestHandler<GetBookingsQuery, IEnumerable<BookingDto>>
{
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IMapper _mapper;

    public GetBookingsQueryHandler(
        IRepository<Booking> bookingRepository,
        IRepository<Screen> screenRepository,
        IMapper mapper)
    {
        _bookingRepository = bookingRepository;
        _screenRepository = screenRepository;
        _mapper = mapper;
    }

    public async Task<IEnumerable<BookingDto>> Handle(GetBookingsQuery request, CancellationToken cancellationToken)
    {
        // Get all bookings (navigation properties should be loaded by repository)
        var allBookings = (await _bookingRepository.GetAllAsync(cancellationToken)).ToList();

        // Filter by advertiser if specified (skip if Campaign is null)
        if (request.UserId.HasValue)
        {
            allBookings = allBookings.Where(b => 
                b.Campaign != null && b.Campaign.AdvertiserId == request.UserId.Value
            ).ToList();
        }

        // Filter by screen owner if specified
        if (request.ScreenOwnerId.HasValue)
        {
            var ownerScreenIds = (await _screenRepository.GetAllAsync(cancellationToken))
                .Where(s => s.OwnerId == request.ScreenOwnerId.Value)
                .Select(s => s.Id)
                .ToList();

            allBookings = allBookings.Where(b => ownerScreenIds.Contains(b.ScreenId)).ToList();
        }

        // Filter by campaign if specified
        if (request.CampaignId.HasValue)
        {
            allBookings = allBookings.Where(b => b.CampaignId == request.CampaignId.Value).ToList();
        }

        return _mapper.Map<IEnumerable<BookingDto>>(allBookings.OrderByDescending(b => b.CreatedAt));
    }
}
