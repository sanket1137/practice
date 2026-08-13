namespace CCMS.Domain.Entities;

public class ScheduleWindow : BaseEntity
{
    public Guid ScreenId { get; set; }
    public Guid PlaylistId { get; set; }
    public int DaysOfWeekMask { get; set; }
    public int StartMinute { get; set; }
    public int EndMinute { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Label { get; set; }
    public virtual Screen Screen { get; set; } = null!;
    public virtual Playlist Playlist { get; set; } = null!;
}