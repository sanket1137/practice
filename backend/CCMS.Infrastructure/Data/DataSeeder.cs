using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.ValueObjects;
using CCMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CCMS.Infrastructure.Data;

public static class DataSeeder
{
    public static async Task SeedAsync(ApplicationDbContext context)
    {
        // Skip if data already exists
        if (await context.Users.AnyAsync(u => u.Email == "advertiser1@example.com"))
            return;

        // Create Users
        var advertiser1 = new User
        {
            Id = Guid.NewGuid(),
            Email = "advertiser1@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123!"),
            FirstName = "John",
            LastName = "Advertiser",
            Role = UserRole.Advertiser,
            CreatedAt = DateTime.UtcNow
        };

        var advertiser2 = new User
        {
            Id = Guid.NewGuid(),
            Email = "advertiser2@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123!"),
            FirstName = "Jane",
            LastName = "Marketing",
            Role = UserRole.Advertiser,
            CreatedAt = DateTime.UtcNow
        };

        var owner1 = new User
        {
            Id = Guid.NewGuid(),
            Email = "owner1@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123!"),
            FirstName = "Mike",
            LastName = "ScreenOwner",
            Role = UserRole.ScreenOwner,
            CreatedAt = DateTime.UtcNow
        };

        var owner2 = new User
        {
            Id = Guid.NewGuid(),
            Email = "owner2@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123!"),
            FirstName = "Sarah",
            LastName = "Media",
            Role = UserRole.ScreenOwner,
            CreatedAt = DateTime.UtcNow
        };

        var admin = new User
        {
            Id = Guid.NewGuid(),
            Email = "admin@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123!"),
            FirstName = "Admin",
            LastName = "User",
            Role = UserRole.Admin,
            CreatedAt = DateTime.UtcNow
        };

        var sanketAdmin = new User
        {
            Id = Guid.NewGuid(),
            Email = "sanket@pixelspot.in",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("TempAdmin@123"),
            FirstName = "Sanket",
            LastName = "Admin",
            Role = UserRole.Admin,
            IsEmailVerified = true,
            CreatedAt = DateTime.UtcNow
        };

        context.Users.AddRange(advertiser1, advertiser2, owner1, owner2, admin, sanketAdmin);
        await context.SaveChangesAsync();

        // Create Screens
        var screen1 = new Screen
        {
            Id = Guid.NewGuid(),
            OwnerId = owner1.Id,
            Name = "Times Square LED Wall",
            Description = "Premium outdoor LED display in the heart of Times Square",
            PhysicalWidth = 20,
            PhysicalHeight = 15,
            DimensionUnit = "feet",
            ResolutionWidth = 1920,
            ResolutionHeight = 1080,
            Location = new Address
            {
                Street = "Broadway & 7th Ave",
                City = "New York",
                State = "NY",
                Country = "USA",
                PostalCode = "10036"
            },
            Latitude = 40.758m,
            Longitude = -73.985m,
            Schedule = CreateDefaultSchedule(),
            TimeFrameMinutes = 1,
            SlotsPerFrame = 6,
            DeviceId = "device-001",
            Status = ScreenStatus.Active,
            IsOnline = true,
            LastSeenAt = DateTime.UtcNow,
            ConnectedDeviceId = "rpi-001",
            PricePerSlot = 50,
            Currency = "USD",
            CreatedAt = DateTime.UtcNow
        };

        var screen2 = new Screen
        {
            Id = Guid.NewGuid(),
            OwnerId = owner1.Id,
            Name = "Downtown Mall Display",
            Description = "Indoor digital signage at premium shopping mall",
            PhysicalWidth = 10,
            PhysicalHeight = 6,
            DimensionUnit = "feet",
            ResolutionWidth = 1920,
            ResolutionHeight = 1080,
            Location = new Address
            {
                Street = "123 Mall Street",
                City = "Los Angeles",
                State = "CA",
                Country = "USA",
                PostalCode = "90001"
            },
            Latitude = 34.052m,
            Longitude = -118.243m,
            Schedule = CreateDefaultSchedule(),
            TimeFrameMinutes = 1,
            SlotsPerFrame = 8,
            DeviceId = "device-002",
            Status = ScreenStatus.Active,
            IsOnline = true,
            LastSeenAt = DateTime.UtcNow,
            ConnectedDeviceId = "rpi-002",
            PricePerSlot = 30,
            Currency = "USD",
            CreatedAt = DateTime.UtcNow
        };

        var screen3 = new Screen
        {
            Id = Guid.NewGuid(),
            OwnerId = owner2.Id,
            Name = "Airport Terminal Screen",
            Description = "High-traffic digital display at airport terminal",
            PhysicalWidth = 12,
            PhysicalHeight = 8,
            DimensionUnit = "feet",
            ResolutionWidth = 1920,
            ResolutionHeight = 1080,
            Location = new Address
            {
                Street = "Terminal 1",
                City = "Chicago",
                State = "IL",
                Country = "USA",
                PostalCode = "60666"
            },
            Latitude = 41.9742m,
            Longitude = -87.9073m,
            Schedule = Create24HourSchedule(),
            TimeFrameMinutes = 1,
            SlotsPerFrame = 10,
            DeviceId = "device-003",
            Status = ScreenStatus.Active,
            IsOnline = false,
            LastSeenAt = DateTime.UtcNow.AddHours(-2),
            PricePerSlot = 45,
            Currency = "USD",
            CreatedAt = DateTime.UtcNow
        };

        var screen4 = new Screen
        {
            Id = Guid.NewGuid(),
            OwnerId = owner2.Id,
            Name = "Subway Station Display",
            Description = "Digital billboard at busy subway station",
            PhysicalWidth = 8,
            PhysicalHeight = 4,
            DimensionUnit = "feet",
            ResolutionWidth = 1920,
            ResolutionHeight = 1080,
            Location = new Address
            {
                Street = "Main Station",
                City = "San Francisco",
                State = "CA",
                Country = "USA",
                PostalCode = "94102"
            },
            Latitude = 37.7749m,
            Longitude = -122.4194m,
            Schedule = Create24HourSchedule(),
            TimeFrameMinutes = 1,
            SlotsPerFrame = 6,
            DeviceId = "device-004",
            Status = ScreenStatus.Maintenance,
            IsOnline = false,
            LastSeenAt = DateTime.UtcNow.AddDays(-1),
            PricePerSlot = 20,
            Currency = "USD",
            CreatedAt = DateTime.UtcNow
        };

        var screen5 = new Screen
        {
            Id = Guid.NewGuid(),
            OwnerId = owner1.Id,
            Name = "Stadium Jumbotron",
            Description = "Massive outdoor screen at sports stadium",
            PhysicalWidth = 40,
            PhysicalHeight = 25,
            DimensionUnit = "feet",
            ResolutionWidth = 3840,
            ResolutionHeight = 2160,
            Location = new Address
            {
                Street = "Stadium Drive",
                City = "Miami",
                State = "FL",
                Country = "USA",
                PostalCode = "33101"
            },
            Latitude = 25.7617m,
            Longitude = -80.1918m,
            Schedule = CreateEventSchedule(),
            TimeFrameMinutes = 2,
            SlotsPerFrame = 4,
            DeviceId = "device-005",
            Status = ScreenStatus.Inactive,
            IsOnline = false,
            PricePerSlot = 100,
            Currency = "USD",
            CreatedAt = DateTime.UtcNow
        };

        context.Screens.AddRange(screen1, screen2, screen3, screen4, screen5);
        await context.SaveChangesAsync();

        // Create Campaigns
        var campaign1 = new Campaign
        {
            Id = Guid.NewGuid(),
            AdvertiserId = advertiser1.Id,
            Name = "Summer Sale 2024",
            Description = "Promote summer products and discounts",
            Budget = 5000,
            Currency = "INR",
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(20)),
            Status = CampaignStatus.Active,
            CreatedAt = DateTime.UtcNow.AddDays(-15)
        };

        var campaign2 = new Campaign
        {
            Id = Guid.NewGuid(),
            AdvertiserId = advertiser1.Id,
            Name = "New Product Launch",
            Description = "Launch campaign for new product line",
            Budget = 3000,
            Currency = "INR",
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(35)),
            Status = CampaignStatus.Draft,
            CreatedAt = DateTime.UtcNow.AddDays(-5)
        };

        var campaign3 = new Campaign
        {
            Id = Guid.NewGuid(),
            AdvertiserId = advertiser2.Id,
            Name = "Holiday Season Promo",
            Description = "Holiday discounts and special offers",
            Budget = 7500,
            Currency = "INR",
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(60)),
            Status = CampaignStatus.Draft,
            CreatedAt = DateTime.UtcNow.AddDays(-2)
        };

        var campaign4 = new Campaign
        {
            Id = Guid.NewGuid(),
            AdvertiserId = advertiser2.Id,
            Name = "Brand Awareness Q4",
            Description = "Build brand recognition in key markets",
            Budget = 10000,
            Currency = "INR",
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-5)),
            Status = CampaignStatus.Completed,
            CreatedAt = DateTime.UtcNow.AddDays(-45)
        };

        context.Campaigns.AddRange(campaign1, campaign2, campaign3, campaign4);
        await context.SaveChangesAsync();

        // Create Creatives
        var creative1 = new Creative
        {
            Id = Guid.NewGuid(),
            CampaignId = campaign1.Id,
            Name = "Summer Sale Banner",
            FileUrl = "/uploads/creatives/summer-sale-banner.jpg",
            FileName = "summer-sale-banner.jpg",
            MimeType = "image/jpeg",
            FileSize = 1024000,
            FileHash = "abc123",
            Duration = 10,
            Width = 1920,
            Height = 1080,
            CreatedAt = DateTime.UtcNow.AddDays(-12)
        };

        var creative2 = new Creative
        {
            Id = Guid.NewGuid(),
            CampaignId = campaign1.Id,
            Name = "Products Showcase Video",
            FileUrl = "/uploads/creatives/products-video.mp4",
            FileName = "products-video.mp4",
            MimeType = "video/mp4",
            FileSize = 5120000,
            FileHash = "def456",
            Duration = 15,
            Width = 1920,
            Height = 1080,
            CreatedAt = DateTime.UtcNow.AddDays(-10)
        };

        var creative3 = new Creative
        {
            Id = Guid.NewGuid(),
            CampaignId = campaign2.Id,
            Name = "New Product Teaser",
            FileUrl = "/uploads/creatives/product-teaser.jpg",
            FileName = "product-teaser.jpg",
            MimeType = "image/jpeg",
            FileSize = 890000,
            FileHash = "ghi789",
            Duration = 8,
            Width = 1920,
            Height = 1080,
            CreatedAt = DateTime.UtcNow.AddDays(-4)
        };

        var creative4 = new Creative
        {
            Id = Guid.NewGuid(),
            CampaignId = campaign3.Id,
            Name = "Holiday Greetings",
            FileUrl = "/uploads/creatives/holiday-greetings.jpg",
            FileName = "holiday-greetings.jpg",
            MimeType = "image/jpeg",
            FileSize = 756000,
            FileHash = "jkl012",
            Duration = 12,
            Width = 1920,
            Height = 1080,
            CreatedAt = DateTime.UtcNow.AddDays(-1)
        };

        context.Creatives.AddRange(creative1, creative2, creative3, creative4);
        await context.SaveChangesAsync();

        // Create Bookings
        var booking1 = new Booking
        {
            Id = Guid.NewGuid(),
            ScreenId = screen1.Id,
            CampaignId = campaign1.Id,
            CreativeId = creative1.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-5)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(15)),
            SlotNumbers = new List<int> { 1, 2, 3 },
            Status = BookingStatus.Approved,
            ApprovedBy = owner1.Id,
            ApprovedAt = DateTime.UtcNow.AddDays(-6),
            ExpectedImpressions = 50000,
            DeliveredImpressions = 25000,
            TotalPrice = 750,
            Currency = "INR",
            CreatedAt = DateTime.UtcNow.AddDays(-7)
        };

        var booking2 = new Booking
        {
            Id = Guid.NewGuid(),
            ScreenId = screen2.Id,
            CampaignId = campaign1.Id,
            CreativeId = creative2.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(12)),
            SlotNumbers = new List<int> { 1, 2 },
            Status = BookingStatus.Pending,
            ExpectedImpressions = 30000,
            DeliveredImpressions = 0,
            TotalPrice = 300,
            Currency = "INR",
            CreatedAt = DateTime.UtcNow.AddDays(-1)
        };

        var booking3 = new Booking
        {
            Id = Guid.NewGuid(),
            ScreenId = screen3.Id,
            CampaignId = campaign4.Id,
            CreativeId = creative1.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-25)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
            SlotNumbers = new List<int> { 1, 4, 5 },
            Status = BookingStatus.Completed,
            ApprovedBy = owner2.Id,
            ApprovedAt = DateTime.UtcNow.AddDays(-26),
            ExpectedImpressions = 75000,
            DeliveredImpressions = 73500,
            TotalPrice = 675,
            Currency = "INR",
            CreatedAt = DateTime.UtcNow.AddDays(-30)
        };

        var booking4 = new Booking
        {
            Id = Guid.NewGuid(),
            ScreenId = screen1.Id,
            CampaignId = campaign2.Id,
            CreativeId = creative3.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(21)),
            SlotNumbers = new List<int> { 4, 5 },
            Status = BookingStatus.Rejected,
            RejectionReason = "Time slots already booked for this period",
            ExpectedImpressions = 40000,
            DeliveredImpressions = 0,
            TotalPrice = 500,
            Currency = "INR",
            CreatedAt = DateTime.UtcNow.AddDays(-3)
        };

        context.Bookings.AddRange(booking1, booking2, booking3, booking4);
        await context.SaveChangesAsync();
    }

    internal static OperatingSchedule CreateDefaultSchedule()
    {
        return new OperatingSchedule
        {
            Monday = new DaySchedule { IsOperating = true, StartTime = TimeSpan.FromHours(9), EndTime = TimeSpan.FromHours(22) },
            Tuesday = new DaySchedule { IsOperating = true, StartTime = TimeSpan.FromHours(9), EndTime = TimeSpan.FromHours(22) },
            Wednesday = new DaySchedule { IsOperating = true, StartTime = TimeSpan.FromHours(9), EndTime = TimeSpan.FromHours(22) },
            Thursday = new DaySchedule { IsOperating = true, StartTime = TimeSpan.FromHours(9), EndTime = TimeSpan.FromHours(22) },
            Friday = new DaySchedule { IsOperating = true, StartTime = TimeSpan.FromHours(9), EndTime = TimeSpan.FromHours(23) },
            Saturday = new DaySchedule { IsOperating = true, StartTime = TimeSpan.FromHours(10), EndTime = TimeSpan.FromHours(23) },
            Sunday = new DaySchedule { IsOperating = true, StartTime = TimeSpan.FromHours(10), EndTime = TimeSpan.FromHours(21) }
        };
    }

    private static OperatingSchedule Create24HourSchedule()
    {
        // Use 23:59:59 instead of 24:00:00 to avoid SQL Time overflow (max is 23:59:59.9999999)
        var endOfDay = new TimeSpan(23, 59, 59);
        return new OperatingSchedule
        {
            Monday = new DaySchedule { IsOperating = true, StartTime = TimeSpan.Zero, EndTime = endOfDay },
            Tuesday = new DaySchedule { IsOperating = true, StartTime = TimeSpan.Zero, EndTime = endOfDay },
            Wednesday = new DaySchedule { IsOperating = true, StartTime = TimeSpan.Zero, EndTime = endOfDay },
            Thursday = new DaySchedule { IsOperating = true, StartTime = TimeSpan.Zero, EndTime = endOfDay },
            Friday = new DaySchedule { IsOperating = true, StartTime = TimeSpan.Zero, EndTime = endOfDay },
            Saturday = new DaySchedule { IsOperating = true, StartTime = TimeSpan.Zero, EndTime = endOfDay },
            Sunday = new DaySchedule { IsOperating = true, StartTime = TimeSpan.Zero, EndTime = endOfDay }
        };
    }

    private static OperatingSchedule CreateEventSchedule()
    {
        return new OperatingSchedule
        {
            Monday = new DaySchedule { IsOperating = false },
            Tuesday = new DaySchedule { IsOperating = false },
            Wednesday = new DaySchedule { IsOperating = true, StartTime = TimeSpan.FromHours(18), EndTime = TimeSpan.FromHours(23) },
            Thursday = new DaySchedule { IsOperating = false },
            Friday = new DaySchedule { IsOperating = true, StartTime = TimeSpan.FromHours(18), EndTime = TimeSpan.FromHours(23) },
            Saturday = new DaySchedule { IsOperating = true, StartTime = TimeSpan.FromHours(12), EndTime = TimeSpan.FromHours(23) },
            Sunday = new DaySchedule { IsOperating = true, StartTime = TimeSpan.FromHours(13), EndTime = TimeSpan.FromHours(22) }
        };
    }
}
