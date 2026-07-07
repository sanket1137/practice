namespace CCMS.Shared.DTOs.Profile;

public class ProfileDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string Role { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public string? CompanyName { get; set; }
    public string? GstNumber { get; set; }
    public string ThemePreference { get; set; } = "dark";
    public string AccountVisibility { get; set; } = "Public";
    public bool IsEmailVerified { get; set; }
    public bool IsPhoneVerified { get; set; }
    public BankAccountDto? BankAccount { get; set; }
    public string AccountType { get; set; } = "MediaOwner";
}

public class SwitchAccountTypeRequest
{
    public string TargetAccountType { get; set; } = string.Empty;
}

public class ScreenUpgradeRequiredDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool NeedsPricing { get; set; }
    public bool NeedsAddress { get; set; }
    public bool NeedsSchedule { get; set; }
}

public class AccountTypeSwitchPreflightDto
{
    public string TargetAccountType { get; set; } = string.Empty;
    public bool CanSwitchNow { get; set; }
    public List<ScreenUpgradeRequiredDto> ScreensRequiringUpgrade { get; set; } = new();
}

public class UpdateProfileRequest
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? PhoneNumber { get; set; }
    public string? CompanyName { get; set; }
    public string? GstNumber { get; set; }
    public string? ThemePreference { get; set; }
}

public class BankAccountDto
{
    public Guid Id { get; set; }
    public string BeneficiaryName { get; set; } = string.Empty;
    public string AccountNumberMasked { get; set; } = string.Empty;
    public string IfscCode { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public bool IsVerified { get; set; }
}

public class UpdateBankAccountRequest
{
    public string BeneficiaryName { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string IfscCode { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
}

public class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class UpdateVisibilityRequest
{
    public string Visibility { get; set; } = "Public";
}

public class SubmitVisibilityRequestBody
{
    public string? Message { get; set; }
}

public class RejectVisibilityRequestBody
{
    public string Reason { get; set; } = string.Empty;
}

public class VisibilityRequestDto
{
    public Guid Id { get; set; }
    public string RequestedVisibility { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? RequestMessage { get; set; }
    public DateTime RequestedAt { get; set; }
    public DateTime? AdminReviewedAt { get; set; }
    public string? RejectionReason { get; set; }
}

public class VisibilityRequestDetailDto : VisibilityRequestDto
{
    public Guid UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string UserEmail { get; set; } = string.Empty;
    public int ScreensCount { get; set; }
    public string? AdminReviewedByName { get; set; }
}
