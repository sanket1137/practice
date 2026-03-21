namespace CCMS.Shared.DTOs.Verification;

// ── Player-facing DTOs ──

public class QrChallengeResponse
{
    public string Code { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public string QrContent { get; set; } = string.Empty;
}

public class ScreenVerificationStatusResponse
{
    public string Status { get; set; } = string.Empty;
    public bool CanPlay { get; set; }
}

// ── Owner-facing DTOs ──

public class ScanQrRequest
{
    public string ChallengeCode { get; set; } = string.Empty;
    public decimal GpsLatitude { get; set; }
    public decimal GpsLongitude { get; set; }
}

public class ScanQrResponse
{
    public Guid VerificationId { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class VerificationHistoryItemDto
{
    public Guid Id { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? DeviceType { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? AdminReviewedAt { get; set; }
}

// ── Admin-facing DTOs ──

public class AdminVerificationListItemDto
{
    public Guid Id { get; set; }
    public Guid ScreenId { get; set; }
    public string ScreenName { get; set; } = string.Empty;
    public string OwnerName { get; set; } = string.Empty;
    public string OwnerEmail { get; set; } = string.Empty;
    public string? DeviceType { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal? ScanGpsLatitude { get; set; }
    public decimal? ScanGpsLongitude { get; set; }
    public decimal ScreenLatitude { get; set; }
    public decimal ScreenLongitude { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool HasVideo { get; set; }
}

public class AdminVerificationDetailDto
{
    public Guid Id { get; set; }
    public Guid ScreenId { get; set; }
    public string ScreenName { get; set; } = string.Empty;
    public string ScreenAddress { get; set; } = string.Empty;
    public string OwnerName { get; set; } = string.Empty;
    public string OwnerEmail { get; set; } = string.Empty;
    public string? VideoUrl { get; set; }
    public string? DeviceType { get; set; }
    public string? DeviceFingerprintPrefix { get; set; }
    public string QrChallengeCode { get; set; } = string.Empty;
    public decimal? ScanGpsLatitude { get; set; }
    public decimal? ScanGpsLongitude { get; set; }
    public decimal ScreenLatitude { get; set; }
    public decimal ScreenLongitude { get; set; }
    public double? GpsDistanceMeters { get; set; }
    public string? PlayerIpAddress { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? RejectionReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? AdminReviewedAt { get; set; }
    public string? AdminReviewedByName { get; set; }
}

public class AdminRejectVerificationRequest
{
    public string Reason { get; set; } = string.Empty;
}
