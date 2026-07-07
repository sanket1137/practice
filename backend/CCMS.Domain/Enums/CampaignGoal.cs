namespace CCMS.Domain.Enums;

/// <summary>
/// Advertiser-declared goal for a campaign. Drives recommended screens,
/// creative templates, and pricing presets. Optional — campaigns without a
/// goal still behave as generic ad campaigns.
/// </summary>
public enum CampaignGoal
{
    Awareness = 0,
    Marketing = 1,
    Promotion = 2,
    Branding = 3,
    LaunchCampaign = 4,
    EventPromotion = 5,
    OffersDiscounts = 6
}
