namespace CCMS.Domain.Entities;

public class BankAccount : BaseEntity
{
    public Guid UserId { get; set; }
    public string BeneficiaryName { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string IfscCode { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public bool IsVerified { get; set; }

    // Navigation properties
    public virtual User User { get; set; } = null!;
}
