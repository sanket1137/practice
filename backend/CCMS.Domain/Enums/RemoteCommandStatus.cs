namespace CCMS.Domain.Enums;

public enum RemoteCommandStatus
{
    Pending = 0,  // Persisted, awaiting dispatch
    Sent = 1,     // Broadcast to player group
    Acked = 2,    // Player acknowledged
    Failed = 3,   // Player reported failure
    Expired = 4,  // Never acked within TTL
}
