namespace CCMS.Domain.Entities;

/// <summary>
/// One sealed day of a screen's play log — a link in a per-screen hash chain.
///
/// RecordsRoot = SHA-256 over the canonical forms of every impression recorded
/// for the screen on that day (sorted deterministically). SealHash binds the
/// root to the previous day's seal, so the seals form a chain: editing any
/// historical impression changes its day's recomputed root, which no longer
/// matches the stored seal, and forging a seal breaks every seal after it.
/// Seals are computed once when a closed day is first requested and are never
/// updated — verification always recomputes from raw records and compares.
/// </summary>
public class PlayLogSeal : BaseEntity
{
    public Guid ScreenId { get; set; }
    /// <summary>UTC day this seal covers (date component only).</summary>
    public DateTime Day { get; set; }
    public int RecordCount { get; set; }
    /// <summary>SHA-256 (hex) over the day's canonical impression records.</summary>
    public string RecordsRoot { get; set; } = string.Empty;
    /// <summary>SealHash of the previous sealed day for this screen; "GENESIS" for the first.</summary>
    public string PrevSealHash { get; set; } = string.Empty;
    /// <summary>SHA-256 (hex) of ScreenId|Day|RecordCount|RecordsRoot|PrevSealHash.</summary>
    public string SealHash { get; set; } = string.Empty;
    public DateTime SealedAt { get; set; }
    public string Algorithm { get; set; } = "SHA-256 chained v2";

    public Screen Screen { get; set; } = null!;
}
