using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;

namespace CCMS.Infrastructure.Data;

/// <summary>
/// Seeds a realistic spread of marketplace-ready (Active + Verified) digital
/// screens across major Indian cities. Idempotent — safe to invoke on every
/// startup; will skip work once Indian screens already exist.
///
/// Also performs a one-time backfill that approves any pre-existing seeded
/// screens (US demo data) so the advertiser marketplace search returns them.
/// This is required because the marketplace search filter requires
/// <see cref="ScreenVerificationStatus.Verified"/> AND
/// <see cref="ScreenStatus.Active"/>, and previously-seeded demo screens
/// shipped as <see cref="ScreenVerificationStatus.Unverified"/>.
/// </summary>
public static class IndianScreensSeeder
{
    public static async Task SeedAsync(ApplicationDbContext context)
    {
        // ── Step 1: Backfill any pre-existing demo screens to Verified ─────
        // Idempotent — only flips rows that are still Unverified.
        var staleScreens = await context.Screens
            .Where(s => !s.IsDeleted
                && s.Status == ScreenStatus.Active
                && s.VerificationStatus == ScreenVerificationStatus.Unverified)
            .ToListAsync();
        if (staleScreens.Count > 0)
        {
            var nowUtc = DateTime.UtcNow;
            foreach (var s in staleScreens)
            {
                s.VerificationStatus = ScreenVerificationStatus.Verified;
                s.VerifiedAt = nowUtc;
            }
            await context.SaveChangesAsync();
        }

        // ── Step 2: Skip India seeding if our seed batch already present ──
        // Use a distinct name sentinel ("PixelSpot ... Plaza Display") so we
        // don't false-positive on pre-existing user/test screens that happen
        // to be located in India.
        if (await context.Screens.AnyAsync(s => s.Name.StartsWith("PixelSpot ") && s.Name.EndsWith(" Plaza Display")))
            return;

        // Need an owner to attribute the screens to. Falls back to first owner.
        var owner = await context.Users
            .Where(u => u.Role == UserRole.ScreenOwner)
            .OrderBy(u => u.CreatedAt)
            .FirstOrDefaultAsync();
        if (owner == null) return; // No screen owner yet — nothing to attach to.

        // ── Step 3: Seed 30+ Indian-city screens across all major states ──
        var cities = new (string City, string State, string PostalCode, decimal Lat, decimal Lng, decimal PricePerSlot)[]
        {
            ("Mumbai",            "Maharashtra",       "400001", 19.0760m, 72.8777m, 280m),
            ("Pune",              "Maharashtra",       "411001", 18.5204m, 73.8567m, 180m),
            ("Nagpur",            "Maharashtra",       "440001", 21.1458m, 79.0882m, 120m),
            ("Delhi",             "Delhi",             "110001", 28.6139m, 77.2090m, 300m),
            ("Bengaluru",         "Karnataka",         "560001", 12.9716m, 77.5946m, 250m),
            ("Mysuru",            "Karnataka",         "570001", 12.2958m, 76.6394m, 110m),
            ("Chennai",           "Tamil Nadu",        "600001", 13.0827m, 80.2707m, 220m),
            ("Coimbatore",        "Tamil Nadu",        "641001", 11.0168m, 76.9558m, 140m),
            ("Kolkata",           "West Bengal",       "700001", 22.5726m, 88.3639m, 200m),
            ("Hyderabad",         "Telangana",         "500001", 17.3850m, 78.4867m, 230m),
            ("Ahmedabad",         "Gujarat",           "380001", 23.0225m, 72.5714m, 180m),
            ("Vadodara",          "Gujarat",           "390001", 22.3072m, 73.1812m, 130m),
            ("Surat",             "Gujarat",           "395001", 21.1702m, 72.8311m, 150m),
            ("Jaipur",            "Rajasthan",         "302001", 26.9124m, 75.7873m, 170m),
            ("Udaipur",           "Rajasthan",         "313001", 24.5854m, 73.7125m, 110m),
            ("Lucknow",           "Uttar Pradesh",     "226001", 26.8467m, 80.9462m, 160m),
            ("Kanpur",            "Uttar Pradesh",     "208001", 26.4499m, 80.3319m, 120m),
            ("Agra",              "Uttar Pradesh",     "282001", 27.1767m, 78.0081m, 110m),
            ("Noida",             "Uttar Pradesh",     "201301", 28.5355m, 77.3910m, 220m),
            ("Indore",            "Madhya Pradesh",    "452001", 22.7196m, 75.8577m, 140m),
            ("Bhopal",            "Madhya Pradesh",    "462001", 23.2599m, 77.4126m, 130m),
            ("Patna",             "Bihar",             "800001", 25.5941m, 85.1376m, 110m),
            ("Ludhiana",          "Punjab",            "141001", 30.9010m, 75.8573m, 130m),
            ("Amritsar",          "Punjab",            "143001", 31.6340m, 74.8723m, 120m),
            ("Visakhapatnam",     "Andhra Pradesh",    "530001", 17.6868m, 83.2185m, 140m),
            ("Vijayawada",        "Andhra Pradesh",    "520001", 16.5062m, 80.6480m, 120m),
            ("Kochi",             "Kerala",            "682001", 9.9312m,  76.2673m, 170m),
            ("Thiruvananthapuram","Kerala",            "695001", 8.5241m,  76.9366m, 150m),
            ("Bhubaneswar",       "Odisha",            "751001", 20.2961m, 85.8245m, 120m),
            ("Guwahati",          "Assam",             "781001", 26.1445m, 91.7362m, 110m),
            ("Chandigarh",        "Chandigarh",        "160001", 30.7333m, 76.7794m, 180m),
            ("Gurugram",          "Haryana",           "122001", 28.4595m, 77.0266m, 240m),
            ("Faridabad",         "Haryana",           "121001", 28.4089m, 77.3178m, 150m),
            ("Ranchi",            "Jharkhand",         "834001", 23.3441m, 85.3096m, 100m),
            ("Raipur",            "Chhattisgarh",      "492001", 21.2514m, 81.6296m, 100m),
            ("Dehradun",          "Uttarakhand",       "248001", 30.3165m, 78.0322m, 120m),
            ("Shimla",            "Himachal Pradesh",  "171001", 31.1048m, 77.1734m, 90m),
            ("Srinagar",          "Jammu and Kashmir", "190001", 34.0837m, 74.7973m, 100m),
            ("Panaji",            "Goa",               "403001", 15.4909m, 73.8278m, 160m),
        };

        var nowSeed = DateTime.UtcNow;
        var batch = new List<Screen>(cities.Length);
        var idx = 0;
        foreach (var c in cities)
        {
            idx++;
            batch.Add(new Screen
            {
                Id = Guid.NewGuid(),
                OwnerId = owner.Id,
                Name = $"PixelSpot {c.City} Plaza Display",
                Description = $"Premium high-traffic LED display in {c.City}, {c.State}. Ideal for brand awareness campaigns across {c.State}.",
                PhysicalWidth = 10m,
                PhysicalHeight = 6m,
                DimensionUnit = "feet",
                ResolutionWidth = 1920,
                ResolutionHeight = 1080,
                Location = new Address
                {
                    Street = $"Main Plaza, {c.City} Central",
                    City = c.City,
                    State = c.State,
                    Country = "India",
                    PostalCode = c.PostalCode,
                },
                Latitude = c.Lat,
                Longitude = c.Lng,
                Timezone = "Asia/Kolkata",
                Schedule = DataSeeder.CreateDefaultSchedule(),
                TimeFrameMinutes = 10,
                SlotsPerFrame = 6,
                DeviceId = $"in-seed-{idx:D3}",
                Status = ScreenStatus.Active,
                VerificationStatus = ScreenVerificationStatus.Verified,
                VerifiedAt = nowSeed,
                IsOnline = true,
                LastSeenAt = nowSeed,
                PricePerSlot = c.PricePerSlot,
                Currency = "INR",
                CommissionPercentage = 15m,
                DisplayType = ScreenDisplayType.Outdoor,
                Orientation = ScreenOrientation.Landscape,
                AudienceQualityScore = 75m,
                CreatedAt = nowSeed,
            });
        }

        context.Screens.AddRange(batch);
        await context.SaveChangesAsync();
    }
}
