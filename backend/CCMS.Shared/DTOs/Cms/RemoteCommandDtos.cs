namespace CCMS.Shared.DTOs.Cms;

public class IssueRemoteCommandRequest
{
    public Guid ScreenId { get; set; }

    /// <summary>Command name, e.g. "Play", "Pause", "SetVolume", "PushAnnouncement".</summary>
    public string CommandType { get; set; } = string.Empty;

    /// <summary>Arbitrary JSON-encodable payload for the command (volume, text, etc.).</summary>
    public object? Payload { get; set; }
}

public class BulkIssueRemoteCommandRequest
{
    public List<Guid> ScreenIds { get; set; } = new();
    public string CommandType { get; set; } = string.Empty;
    public object? Payload { get; set; }
}

public class RemoteCommandDto
{
    public Guid Id { get; set; }
    public Guid ScreenId { get; set; }
    public string CommandType { get; set; } = string.Empty;
    public string? PayloadJson { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime IssuedAt { get; set; }
    public DateTime? DispatchedAt { get; set; }
    public DateTime? AckedAt { get; set; }
    public string? ErrorMessage { get; set; }
}

public class AckCommandRequest
{
    public Guid CommandId { get; set; }
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
}
