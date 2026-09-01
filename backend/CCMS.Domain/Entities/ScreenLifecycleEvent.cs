using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

/// <summary>
/// Audit row for every screen lifecycle transition. Written exclusively by
/// ScreenLifecycleService so the history answers "who put this screen in this
/// state, when, and why" — including system transitions (verification passing)
/// and admin overrides.
/// </summary>
public class ScreenLifecycleEvent : BaseEntity
{
    public Guid ScreenId { get; set; }
    public Screen? Screen { get; set; }

    public ScreenStatus FromStatus { get; set; }
    public ScreenStatus ToStatus { get; set; }

    /// <summary>User who triggered the transition; null for system transitions.</summary>
    public Guid? ActorUserId { get; set; }

    /// <summary>"Owner", "Admin" or "System" — denormalized for cheap audit reads.</summary>
    public string ActorRole { get; set; } = "System";

    public string? Reason { get; set; }
}
