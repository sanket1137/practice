using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

public class WalletTransaction : BaseEntity
{
    public Guid WalletId { get; set; }
    public WalletTransactionType Type { get; set; }
    public decimal Amount { get; set; }
    public string? Description { get; set; }

    // Reference to related entity (e.g., Booking, Payout)
    public Guid? ReferenceId { get; set; }
    public string? ReferenceType { get; set; }

    // Balance snapshot
    public decimal BalanceBefore { get; set; }
    public decimal BalanceAfter { get; set; }

    // Navigation properties
    public virtual Wallet Wallet { get; set; } = null!;
}
