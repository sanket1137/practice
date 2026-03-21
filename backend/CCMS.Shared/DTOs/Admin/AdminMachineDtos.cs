namespace CCMS.Shared.DTOs.Admin;

public class AdminMachineDto
{
    public Guid Id { get; set; }
    public Guid AdminUserId { get; set; }
    public string AdminName { get; set; } = string.Empty;
    public string MachineName { get; set; } = string.Empty;
    public string? MachineDetails { get; set; }
    public string Status { get; set; } = string.Empty;
    public Guid AuthorizedByUserId { get; set; }
    public string AuthorizedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
}

public class AuthorizeMachineRequest
{
    public string MachineFingerprint { get; set; } = string.Empty;
    public string MachineName { get; set; } = string.Empty;
    public string? MachineDetails { get; set; }
}

public class MachineStatusResponse
{
    public bool IsAuthorized { get; set; }
    public string? MachineName { get; set; }
    public DateTime? LastUsedAt { get; set; }
}
