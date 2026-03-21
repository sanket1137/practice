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
