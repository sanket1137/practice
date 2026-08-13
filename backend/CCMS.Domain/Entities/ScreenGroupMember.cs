namespace CCMS.Domain.Entities;

public class ScreenGroupMember
{
    public Guid ScreenGroupId { get; set; }
    public Guid ScreenId { get; set; }
    public virtual ScreenGroup Group { get; set; } = null!;
    public virtual Screen Screen { get; set; } = null!;
}