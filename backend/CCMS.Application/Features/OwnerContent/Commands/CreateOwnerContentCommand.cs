using CCMS.Shared.DTOs.OwnerContent;
using MediatR;

namespace CCMS.Application.Features.OwnerContent.Commands;

public class CreateOwnerContentCommand : IRequest<OwnerContentDto>
{
    public Guid ScreenId { get; set; }
    public Guid OwnerId { get; set; }
    public int SlotNumber { get; set; }
    public string Name { get; set; } = string.Empty;
    public Stream FileStream { get; set; } = null!;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public decimal PricePerPlay { get; set; }
    public string Currency { get; set; } = "INR"; // Default to INR
}
