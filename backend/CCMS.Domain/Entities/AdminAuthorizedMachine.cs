using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

public class AdminAuthorizedMachine : BaseEntity
{
    public Guid AdminUserId { get; set; }
    public string MachineFingerprintHash { get; set; } = string.Empty;
    public string MachineName { get; set; } = string.Empty;
    public string? MachineDetails { get; set; }
    public AdminMachineStatus Status { get; set; } = AdminMachineStatus.Active;
    public Guid AuthorizedByUserId { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public DateTime? RevokedAt { get; set; }

    // Navigation properties
    public virtual User AdminUser { get; set; } = null!;
    public virtual User AuthorizedByUser { get; set; } = null!;
}
