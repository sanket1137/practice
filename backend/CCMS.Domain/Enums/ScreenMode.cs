namespace CCMS.Domain.Enums;

/// <summary>
/// Operating mode for a screen. Derived from the owner's <see cref="AccountType"/>:
/// CmsOwner → Cms, MediaOwner → Dooh. Advertisers do not own screens.
/// </summary>
public enum ScreenMode
{
    Dooh = 0,
    Cms = 1,
}
