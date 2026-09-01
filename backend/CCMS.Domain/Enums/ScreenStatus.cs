namespace CCMS.Domain.Enums;

/// <summary>
/// Screen lifecycle state. Values 4+ are the real lifecycle introduced with the
/// state machine (see ScreenLifecycleService — the only code allowed to change
/// a screen's status after creation). Values 1 and 3 are legacy: "Inactive" is
/// migrated to Paused, and "Offline" was a conflation of connectivity with
/// lifecycle (connectivity lives exclusively in Screen.IsOnline, derived from
/// heartbeats). They remain declared so historic integers still deserialize,
/// but nothing may write them.
/// </summary>
public enum ScreenStatus
{
    /// <summary>Verified and open for booking. The only marketplace-visible state.</summary>
    Active = 0,

    /// <summary>LEGACY — replaced by Paused. Never write.</summary>
    Inactive = 1,

    /// <summary>Temporarily out of service for physical work. Existing bookings notified.</summary>
    Maintenance = 2,

    /// <summary>LEGACY — connectivity is IsOnline, not a lifecycle state. Never write.</summary>
    Offline = 3,

    /// <summary>Being set up by the owner. Invisible to the marketplace and players.</summary>
    Draft = 4,

    /// <summary>Submitted for QR verification; awaiting the verification flow.</summary>
    PendingVerification = 5,

    /// <summary>Verified and configured, but the owner has not opened it for booking yet.</summary>
    Ready = 6,

    /// <summary>Owner paused new bookings. Existing approved bookings still play and pay.</summary>
    Paused = 7,

    /// <summary>Retired. No bookings, hidden everywhere, history preserved.</summary>
    Archived = 8,
}
