using AutoMapper;
using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Screens;

namespace CCMS.Application.Features.Screens.Queries;

public class GetScreenByIdQueryHandler : IRequestHandler<GetScreenByIdQuery, ScreenDto?>
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly IMapper _mapper;

    public GetScreenByIdQueryHandler(
        IRepository<Screen> screenRepository,
        IMapper mapper)
    {
        _screenRepository = screenRepository;
        _mapper = mapper;
    }

    public async Task<ScreenDto?> Handle(GetScreenByIdQuery request, CancellationToken cancellationToken)
    {
        var screen = await _screenRepository.GetByIdAsync(request.ScreenId, cancellationToken);
        return screen != null ? _mapper.Map<ScreenDto>(screen) : null;
    }
}
