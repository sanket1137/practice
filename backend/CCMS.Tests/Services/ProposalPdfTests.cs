using CCMS.Api.Controllers;
using CCMS.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;

namespace CCMS.Tests.Services;

/// <summary>
/// Renders the proposal PDF through the real QuestPDF pipeline. Layout bugs
/// (overflow, invalid spans, null content) only surface at render time, so a
/// green build alone proves nothing about this document.
/// </summary>
public class ProposalPdfTests
{
    // Minimal valid 1×1 PNG — enough to exercise QuestPDF's image pipeline.
    private static readonly byte[] TinyPng = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    private static ProposalPlan RealisticPlan() => new()
    {
        PreparedFor = "Acme Beverages Pvt Ltd",
        From = new DateTime(2026, 9, 3),
        To = new DateTime(2026, 9, 16),
        Days = 14,
        Currency = "INR",
        TotalFootfallPerDay = 61_500,
        TotalEstPlays = 36_288,
        TotalEstCost = 128_940m,
        GeneratedAt = new DateTime(2026, 9, 2, 10, 30, 0, DateTimeKind.Utc),
        Screens =
        [
            new ProposalScreenItem
            {
                ScreenId = Guid.NewGuid(),
                Name = "Chai Days Screen",
                City = "Pune", State = "Maharashtra",
                ScreenType = "TvDisplay", VenueType = "Cafe", Environment = "Indoor", Orientation = "Landscape",
                Description = "Premium 43-inch display at the counter of a busy specialty coffee shop; eye-level placement with long dwell times during morning and evening rush.",
                Tags = ["Food & Beverage", "High Footfall", "Young Professionals", "Morning Rush"],
                ResolutionWidth = 1920, ResolutionHeight = 1080,
                PhysicalSize = "43 × 24 inches", SlotSeconds = 10,
                Aqs = 8.4m, DailyFootfall = 1_500,
                PricePerSlot = 5m, Currency = "INR",
                AvailableDays = 14, TotalDays = 14,
                EstPlays = 12_096, EstCost = 60_480m,
            },
            new ProposalScreenItem
            {
                // Edge: very long name, partial availability, zero AQS/footfall
                ScreenId = Guid.NewGuid(),
                Name = "Phoenix Marketcity Atrium Mega LED Wall — East Wing Entrance Level 2",
                City = "Bengaluru", State = "Karnataka",
                ScreenType = "LedWall", VenueType = "Mall", Environment = "SemiIndoor", Orientation = "Portrait",
                Description = new string('x', 400), // edge: overlong description must truncate, not overflow
                Tags = ["Retail", "Premium Audience"],
                ResolutionWidth = 2160, ResolutionHeight = 3840,
                PhysicalSize = "3.5 × 6.2 m", SlotSeconds = 15,
                Aqs = 0m, DailyFootfall = 0,
                PricePerSlot = 12.5m, Currency = "INR",
                AvailableDays = 9, TotalDays = 14,
                EstPlays = 7_776, EstCost = 48_600m,
            },
            new ProposalScreenItem
            {
                // Edge: missing physical size / resolution zero (unconfigured screen)
                ScreenId = Guid.NewGuid(),
                Name = "Metro Standee 7",
                City = "", State = "",
                ScreenType = "Standee", Environment = "Outdoor", Orientation = "Portrait",
                ResolutionWidth = 0, ResolutionHeight = 0,
                PhysicalSize = "", SlotSeconds = 0,
                Aqs = 5m, DailyFootfall = 60_000,
                PricePerSlot = 1.2m, Currency = "INR",
                AvailableDays = 14, TotalDays = 14,
                EstPlays = 16_416, EstCost = 19_860m,
            },
        ],
    };

    [Fact]
    public void ExportProposalToPdf_RendersValidPdf_ForRealisticAndEdgeCasePlan()
    {
        var service = new ReportExportService(NullLogger<ReportExportService>.Instance);

        var plan = RealisticPlan();
        var images = new Dictionary<Guid, List<byte[]>>
        {
            [plan.Screens[0].ScreenId] = [TinyPng, TinyPng],
            [plan.Screens[1].ScreenId] = [TinyPng],
        };
        var pdf = service.ExportProposalToPdf(plan, images);

        pdf.Should().NotBeNull();
        pdf.Length.Should().BeGreaterThan(5_000, "a rendered proposal is a multi-section document");
        System.Text.Encoding.ASCII.GetString(pdf, 0, 5).Should().Be("%PDF-");

        // Drop a copy where a human can open it (temp dir, fixed name).
        var outPath = Path.Combine(Path.GetTempPath(), "ccms-proposal-test.pdf");
        File.WriteAllBytes(outPath, pdf);
    }

    [Fact]
    public void ExportProposalToPdf_RendersValidPdf_ForSingleScreenNoPreparedFor()
    {
        var service = new ReportExportService(NullLogger<ReportExportService>.Instance);
        var plan = RealisticPlan();
        plan.PreparedFor = null;
        plan.Screens = [plan.Screens[0]];

        var pdf = service.ExportProposalToPdf(plan);

        System.Text.Encoding.ASCII.GetString(pdf, 0, 5).Should().Be("%PDF-");
    }

    [Fact]
    public void ExportProposalToPdf_RendersValidPdf_ForMaxTwentyScreens()
    {
        var service = new ReportExportService(NullLogger<ReportExportService>.Instance);
        var plan = RealisticPlan();
        var template = plan.Screens[0];
        plan.Screens = Enumerable.Range(1, 20).Select(i => new ProposalScreenItem
        {
            ScreenId = Guid.NewGuid(),
            Name = $"Screen {i}",
            City = "Mumbai", State = "Maharashtra",
            ScreenType = template.ScreenType, Environment = template.Environment,
            Orientation = template.Orientation,
            ResolutionWidth = template.ResolutionWidth, ResolutionHeight = template.ResolutionHeight,
            PhysicalSize = template.PhysicalSize, SlotSeconds = template.SlotSeconds,
            Aqs = template.Aqs, DailyFootfall = template.DailyFootfall,
            PricePerSlot = template.PricePerSlot, Currency = template.Currency,
            AvailableDays = template.AvailableDays, TotalDays = template.TotalDays,
            EstPlays = template.EstPlays, EstCost = template.EstCost,
        }).ToList();

        var pdf = service.ExportProposalToPdf(plan);

        System.Text.Encoding.ASCII.GetString(pdf, 0, 5).Should().Be("%PDF-");
    }
}
