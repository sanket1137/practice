namespace CCMS.Domain.Enums;

public enum PaymentStatus
{
    None = 0,
    OrderCreated = 1,
    Captured = 2,
    RefundInitiated = 3,
    Refunded = 4,
    Expired = 5
}
