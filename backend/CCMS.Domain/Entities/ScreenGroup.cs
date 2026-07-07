namespace CCMS.Domain.Entities;

/// <summary>
/// Represents a group of physical screens.
/// Phase 2: simple grouping for synchronized playlists.
/// Phase 5: extended with mosaic grid and bezel compensation.
/// </summary>
public class ScreenGroup : BaseEntity
{
    public Guid OwnerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    // ── Phase 5: Mosaic grid config ───────────────────────────────────────
    public int Rows { get; set; } = 1;
    public int Cols { get; set; } = 1;
    public decimal BezelHorizontalMm { get; set; } = 0;
    public decimal BezelVerticalMm { get; set; } = 0;
    public ScreenGroupContentMode ContentMode { get; set; } = ScreenGroupContentMode.Individual;
    public string? MasterVideoR2Key { get; set; }
    // ─────────────────────────────────────────────────────────────────────

    public bool IsActive { get; set; } = true;

    // Navigation
    public virtual User Owner { get; set; } = null!;

    // Phase 2: simple membership
    public virtual ICollection<ScreenGroupMember> Members { get; set; } = new List<ScreenGroupMember>();

    // Phase 5: position + crop assignments
    public virtual ICollection<ScreenGroupAssignment> ScreenAssignments { get; set; } = new List<ScreenGroupAssignment>();
}

public enum ScreenGroupContentMode
{
    Individual = 0,   // Each screen has its own playlist, synchronized start
    Mosaic = 1,       // Single master video cropped per screen
}

/// <summary>Assigns a screen to a mosaic group with grid position and crop params.</summary>
public class ScreenGroupAssignment : BaseEntity
{
    public Guid GroupId { get; set; }
    public Guid ScreenId { get; set; }
    public int Row { get; set; }
    public int Col { get; set; }

    // Crop parameters (calculated from bezel compensation)
    public int CropX { get; set; }
    public int CropY { get; set; }
    public int CropW { get; set; }
    public int CropH { get; set; }

    // Per-screen crop segment R2 key (filled after master video processing)
    public string? SegmentR2Key { get; set; }

    // Navigation
    public virtual ScreenGroup Group { get; set; } = null!;
    public virtual Screen Screen { get; set; } = null!;
}
