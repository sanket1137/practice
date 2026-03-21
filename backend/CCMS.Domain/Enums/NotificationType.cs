namespace CCMS.Domain.Enums;

public enum NotificationType
{
    BookingCreated = 0,
    BookingApproved = 1,
    BookingRejected = 2,
    BookingCancelled = 3,
    PaymentReceived = 4,
    PayoutProcessed = 5,
    SystemAlert = 6,
    BookingUpdated = 7,
    RefundProcessed = 8,
    PaymentReceivedAdmin = 9,
    PayoutAdvanceProcessed = 10,
    PayoutFinalPending = 11,
    PayoutFinalProcessed = 12,
}
