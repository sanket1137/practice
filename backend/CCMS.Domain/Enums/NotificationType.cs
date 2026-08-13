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
    VisibilityRequestSubmitted = 13,
    VisibilityRequestApproved = 14,
    VisibilityRequestRejected = 15,
    // Phase 2
    CreativeApproved = 16,
    CreativeRejected = 17,
    CampaignLive = 18,
    CampaignCompleted = 19,
    ScreenOffline = 20,
    ScreenVerified = 21,
    ScreenVerificationRejected = 22,
    WalletLowBalance = 23,
    BookingAutoApproved = 24,
    PlaylistSyncFailed = 25,
}
