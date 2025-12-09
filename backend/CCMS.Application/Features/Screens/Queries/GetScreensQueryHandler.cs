using AutoMapper;
using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Features.Screens.Queries;

public class GetScreensQueryHandler : IRequestHandler<GetScreensQuery, IEnumerable<ScreenDto>>
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly IMapper _mapper;

    public GetScreensQueryHandler(IRepository<Screen> screenRepository, IMapper mapper)
    {
        _screenRepository = screenRepository;
        _mapper = mapper;
    }

    public async Task<IEnumerable<ScreenDto>> Handle(GetScreensQuery request, CancellationToken cancellationToken)
    {
        var screens = await _screenRepository.GetAllAsync();
        return _mapper.Map<IEnumerable<ScreenDto>>(screens);
    }
}
