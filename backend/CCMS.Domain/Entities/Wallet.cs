namespace CCMS.Domain.Entities;

public class Wallet : BaseEntity
{
    public Guid UserId { get; set; }
    public decimal Balance { get; set; }
    public string Currency { get; set; } = "INR";
    public DateTime? LastTopUpAt { get; set; }

    // Concurrency token for optimistic concurrency
    public uint RowVersion { get; set; }

    // Navigation properties
    public virtual User User { get; set; } = null!;
    public virtual ICollection<WalletTransaction> Transactions { get; set; } = new List<WalletTransaction>();
}
