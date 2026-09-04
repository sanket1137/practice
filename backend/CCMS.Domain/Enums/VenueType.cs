namespace CCMS.Domain.Enums;

/// <summary>
/// The kind of place a screen lives in — the buyer-facing answer to
/// "where will my ad play?". Captured at screen registration and shown
/// on proposals and the marketplace. Distinct from
/// <see cref="ScreenType"/> (the hardware) and
/// <see cref="ScreenDisplayType"/> (indoor/outdoor environment).
/// </summary>
public enum VenueType
{
    Unclassified = 0,
    Cafe = 1,
    Restaurant = 2,
    Bar = 3,
    Mall = 4,
    RetailStore = 5,
    Supermarket = 6,
    Gym = 7,
    Salon = 8,
    Office = 9,
    CoworkingSpace = 10,
    Airport = 11,
    RailwayStation = 12,
    MetroStation = 13,
    BusStand = 14,
    Hotel = 15,
    Hospital = 16,
    Clinic = 17,
    College = 18,
    School = 19,
    Cinema = 20,
    Bank = 21,
    PetrolPump = 22,
    Roadside = 23,
    ResidentialComplex = 24,
    Other = 25,
}
