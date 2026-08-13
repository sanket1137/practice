namespace CCMS.Domain.Enums;

/// <summary>
/// Top-level discriminator for which product experience a user is working in.
/// CmsOwner  → self-managed signage (CMS mode). No marketplace, no billing.
/// MediaOwner → marketplace screen owner (sells DOOH slots to advertisers).
/// Advertiser → marketplace advertiser (books slots on MediaOwner screens).
/// </summary>
public enum AccountType
{
    MediaOwner = 0,
    CmsOwner = 1,
    Advertiser = 2,
}
