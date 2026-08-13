namespace CCMS.Domain.Enums;

public enum ScreenVerificationStatus
{
    Unverified = 0,
    QrDisplayed = 1,
    PendingReview = 2,
    Verified = 3,
    Rejected = 4,
    ReVerificationRequired = 5
}
