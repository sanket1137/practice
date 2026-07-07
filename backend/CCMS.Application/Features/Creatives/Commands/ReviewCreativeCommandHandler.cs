using AutoMapper;
using MediatR;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Application.Interfaces;
using CCMS.Shared.DTOs.Creatives;

namespace CCMS.Application.Features.Creatives.Commands;

public class ReviewCreativeCommandHandler : IRequestHandler<ReviewCreativeCommand, CreativeDto>
{
    private readonly IRepository<Creative> _creativeRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    public ReviewCreativeCommandHandler(
        IRepository<Creative> creativeRepository,
        IUnitOfWork unitOfWork,
        IMapper mapper)
    {
        _creativeRepository = creativeRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<CreativeDto> Handle(ReviewCreativeCommand request, CancellationToken cancellationToken)
    {
        var creative = await _creativeRepository.GetByIdAsync(request.CreativeId, cancellationToken)
            ?? throw new KeyNotFoundException($"Creative {request.CreativeId} not found");

        creative.Status = request.NewStatus;
        creative.ReviewNotes = request.ReviewNotes;
        creative.ReviewedAt = DateTime.UtcNow;
        creative.ReviewedByUserId = request.ReviewedByUserId;

        await _creativeRepository.UpdateAsync(creative, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<CreativeDto>(creative);
    }
}

public class BulkApproveCreativesCommandHandler : IRequestHandler<BulkApproveCreativesCommand, int>
{
    private readonly IRepository<Creative> _creativeRepository;
    private readonly IUnitOfWork _unitOfWork;

    public BulkApproveCreativesCommandHandler(
        IRepository<Creative> creativeRepository,
        IUnitOfWork unitOfWork)
    {
        _creativeRepository = creativeRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<int> Handle(BulkApproveCreativesCommand request, CancellationToken cancellationToken)
    {
        var count = 0;
        foreach (var id in request.CreativeIds)
        {
            var creative = await _creativeRepository.GetByIdAsync(id, cancellationToken);
            if (creative == null) continue;

            creative.Status = CreativeStatus.Approved;
            creative.ReviewedAt = DateTime.UtcNow;
            creative.ReviewedByUserId = request.ReviewedByUserId;
            await _creativeRepository.UpdateAsync(creative, cancellationToken);
            count++;
        }

        if (count > 0)
            await _unitOfWork.SaveChangesAsync(cancellationToken);

        return count;
    }
}
