using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using CCMS.Shared.DTOs.Reports;

namespace CCMS.Api.Services;

/// <summary>
/// Service for exporting reports to CSV and PDF formats
/// </summary>
public class ReportExportService
{
    private readonly ILogger<ReportExportService> _logger;
    
    // Brand colors
    private static readonly string PrimaryColor = "#2563EB"; // Blue
    private static readonly string SecondaryColor = "#10B981"; // Green
    private static readonly string AccentColor = "#8B5CF6"; // Purple
    private static readonly string TextColor = "#1F2937";
    private static readonly string LightGray = "#F3F4F6";

    public ReportExportService(ILogger<ReportExportService> logger)
    {
        _logger = logger;
        // Set QuestPDF license (Community license for open source)
        QuestPDF.Settings.License = LicenseType.Community;
    }

    #region CSV Export

    public byte[] ExportBookingReportToCsv(BookingImpressionReport report)
    {
        using var memoryStream = new MemoryStream();
        using var writer = new StreamWriter(memoryStream);
        using var csv = new CsvWriter(writer, new CsvConfiguration(CultureInfo.InvariantCulture));

        // Write header info as comments
        writer.WriteLine($"# Booking Impression Report");
        writer.WriteLine($"# Campaign: {report.CampaignName}");
        writer.WriteLine($"# Screen: {report.ScreenName} ({report.ScreenLocation})");
        writer.WriteLine($"# Period: {report.ReportPeriod.StartDate:yyyy-MM-dd} to {report.ReportPeriod.EndDate:yyyy-MM-dd}");
        writer.WriteLine($"# Generated: {report.GeneratedAt:yyyy-MM-dd HH:mm:ss} UTC");
        writer.WriteLine($"# Total Plays: {report.TotalPlays}");
        writer.WriteLine($"# Completion Rate: {report.CompletionRate}%");
        writer.WriteLine();

        // Write daily breakdown
        var dailyData = report.DailyBreakdown ?? new List<DailyBreakdown>();
        csv.WriteRecords(dailyData.Select(d => new
        {
            Date = d.Date.ToString("yyyy-MM-dd"),
            d.TotalPlays,
            d.FullPlays,
            d.PartialPlays,
            d.TotalDurationSeconds,
            FirstPlay = d.FirstPlayAt?.ToString("HH:mm:ss") ?? "",
            LastPlay = d.LastPlayAt?.ToString("HH:mm:ss") ?? "",
            CompletionRate = $"{d.CompletionRate}%"
        }));

        writer.Flush();
        return memoryStream.ToArray();
    }

    public byte[] ExportCampaignReportToCsv(CampaignSummaryReport report)
    {
        using var memoryStream = new MemoryStream();
        using var writer = new StreamWriter(memoryStream);
        using var csv = new CsvWriter(writer, new CsvConfiguration(CultureInfo.InvariantCulture));

        writer.WriteLine($"# Campaign Summary Report");
        writer.WriteLine($"# Campaign: {report.CampaignName}");
        writer.WriteLine($"# Period: {report.ReportPeriod.StartDate:yyyy-MM-dd} to {report.ReportPeriod.EndDate:yyyy-MM-dd}");
        writer.WriteLine($"# Generated: {report.GeneratedAt:yyyy-MM-dd HH:mm:ss} UTC");
        writer.WriteLine($"# Total Screens: {report.TotalScreens}");
        writer.WriteLine($"# Total Plays: {report.TotalPlays}");
        writer.WriteLine($"# Completion Rate: {report.CompletionRate}%");
        writer.WriteLine();

        var screenStats = report.ScreenStats ?? new List<ScreenSummary>();
        csv.WriteRecords(screenStats.Select(s => new
        {
            s.ScreenName,
            s.ScreenLocation,
            s.TotalPlays,
            s.FullPlays,
            PartialPlays = s.TotalPlays - s.FullPlays,
            CompletionRate = $"{s.CompletionRate}%"
        }));

        writer.Flush();
        return memoryStream.ToArray();
    }

    public byte[] ExportImpressionLogsToCsv(ImpressionLogsResponse logs)
    {
        using var memoryStream = new MemoryStream();
        using var writer = new StreamWriter(memoryStream);
        using var csv = new CsvWriter(writer, new CsvConfiguration(CultureInfo.InvariantCulture));

        writer.WriteLine($"# Impression Logs");
        writer.WriteLine($"# Booking ID: {logs.BookingId}");
        writer.WriteLine($"# Period: {logs.StartDate:yyyy-MM-dd} to {logs.EndDate:yyyy-MM-dd}");
        writer.WriteLine($"# Total Records: {logs.TotalCount}");
        writer.WriteLine();

        csv.WriteRecords(logs.Logs.Select(l => new
        {
            l.ImpressionId,
            PlayedAt = l.PlayedAt.ToString("yyyy-MM-dd HH:mm:ss"),
            l.DurationSeconds,
            l.ExpectedDurationSeconds,
            l.WasFullPlay,
            l.SlotPosition,
            l.IsVerified,
            l.DeviceId
        }));

        writer.Flush();
        return memoryStream.ToArray();
    }

    #endregion

    #region PDF Export

    public byte[] ExportBookingReportToPdf(BookingImpressionReport report)
    {
        try
        {
            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(40);
                    page.DefaultTextStyle(x => x.FontSize(10).FontColor(Color.FromHex(TextColor)));

                    page.Header().Element(c => ComposeHeader(c, "Booking Impression Report"));
                    
                    page.Content().Element(c => ComposeBookingContent(c, report));
                    
                    page.Footer().Element(ComposeFooter);
                });
            });

            return document.GeneratePdf();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating booking PDF report: {Message}", ex.Message);
            throw;
        }
    }

    public byte[] ExportCampaignReportToPdf(CampaignSummaryReport report)
    {
        try
        {
            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(40);
                    page.DefaultTextStyle(x => x.FontSize(10).FontColor(Color.FromHex(TextColor)));

                    page.Header().Element(c => ComposeHeader(c, "Campaign Summary Report"));
                    
                    page.Content().Element(c => ComposeCampaignContent(c, report));
                    
                    page.Footer().Element(ComposeFooter);
                });
            });

            return document.GeneratePdf();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating campaign PDF report: {Message}", ex.Message);
            throw;
        }
    }

    private void ComposeHeader(IContainer container, string title)
    {
        container.Column(column =>
        {
            column.Item().Row(row =>
            {
                row.RelativeItem().Column(col =>
                {
                    col.Item().Text("PixelSpot")
                        .FontSize(24)
                        .Bold()
                        .FontColor(Color.FromHex(PrimaryColor));
                        
                    col.Item().Text("Media Marketplace")
                        .FontSize(10)
                        .FontColor(Color.FromHex("#6B7280"));
                });

                row.RelativeItem().AlignRight().Column(col =>
                {
                    col.Item().Text(title)
                        .FontSize(16)
                        .Bold()
                        .FontColor(Color.FromHex(TextColor));
                        
                    col.Item().Text($"Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC")
                        .FontSize(9)
                        .FontColor(Color.FromHex("#6B7280"));
                });
            });

            column.Item().PaddingBottom(20);
        });
    }

    private void ComposeBookingContent(IContainer container, BookingImpressionReport report)
    {
        container.Column(col =>
        {
            // Campaign & Screen Info
            col.Item().Background(Color.FromHex(LightGray)).Padding(15).Column(info =>
            {
                info.Item().Row(row =>
                {
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().Text("Campaign").FontSize(9).FontColor(Color.FromHex("#6B7280"));
                        c.Item().Text(report.CampaignName ?? "Unknown").FontSize(12).Bold();
                    });
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().Text("Screen").FontSize(9).FontColor(Color.FromHex("#6B7280"));
                        c.Item().Text(report.ScreenName ?? "Unknown").FontSize(12).Bold();
                        c.Item().Text(report.ScreenLocation ?? "Unknown").FontSize(10).FontColor(Color.FromHex("#6B7280"));
                    });
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().Text("Report Period").FontSize(9).FontColor(Color.FromHex("#6B7280"));
                        if (report.ReportPeriod != null)
                        {
                            c.Item().Text($"{report.ReportPeriod.StartDate:MMM dd, yyyy}").FontSize(11);
                            c.Item().Text($"to {report.ReportPeriod.EndDate:MMM dd, yyyy}").FontSize(11);
                        }
                        else
                        {
                            c.Item().Text("N/A").FontSize(11);
                        }
                    });
                });
            });

            col.Item().PaddingVertical(20);

            // Summary Stats Cards
            col.Item().Row(row =>
            {
                row.RelativeItem().Element(c => ComposeSummaryCard(c, "Total Plays", report.TotalPlays.ToString("N0"), PrimaryColor));
                row.ConstantItem(10);
                row.RelativeItem().Element(c => ComposeSummaryCard(c, "Full Plays", report.FullPlays.ToString("N0"), SecondaryColor));
                row.ConstantItem(10);
                row.RelativeItem().Element(c => ComposeSummaryCard(c, "Completion Rate", $"{report.CompletionRate}%", AccentColor));
                row.ConstantItem(10);
                row.RelativeItem().Element(c => ComposeSummaryCard(c, "Avg Duration", $"{report.AveragePlayDurationSeconds:F1}s", "#F59E0B"));
            });

            col.Item().PaddingVertical(20);

            // Daily Breakdown Chart (simple bar representation)
            col.Item().Text("Daily Performance").FontSize(14).Bold();
            col.Item().PaddingVertical(5);
            
            var dailyData = report.DailyBreakdown ?? new List<DailyBreakdown>();
            col.Item().Element(c => ComposeDailyChart(c, dailyData));

            col.Item().PaddingVertical(20);

            // Daily Breakdown Table
            col.Item().Text("Daily Breakdown").FontSize(14).Bold();
            col.Item().PaddingVertical(5);
            
            col.Item().Element(c => ComposeDailyTable(c, dailyData));
        });
    }

    private void ComposeCampaignContent(IContainer container, CampaignSummaryReport report)
    {
        container.Column(col =>
        {
            // Campaign Info
            col.Item().Background(Color.FromHex(LightGray)).Padding(15).Column(info =>
            {
                info.Item().Row(row =>
                {
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().Text("Campaign").FontSize(9).FontColor(Color.FromHex("#6B7280"));
                        c.Item().Text(report.CampaignName ?? "Unknown").FontSize(14).Bold();
                    });
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().Text("Total Screens").FontSize(9).FontColor(Color.FromHex("#6B7280"));
                        c.Item().Text(report.TotalScreens.ToString()).FontSize(14).Bold();
                    });
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().Text("Report Period").FontSize(9).FontColor(Color.FromHex("#6B7280"));
                        var periodText = report.ReportPeriod != null 
                            ? $"{report.ReportPeriod.StartDate:MMM dd} - {report.ReportPeriod.EndDate:MMM dd, yyyy}"
                            : "N/A";
                        c.Item().Text(periodText).FontSize(11);
                    });
                });
            });

            col.Item().PaddingVertical(20);

            // Summary Stats
            col.Item().Row(row =>
            {
                row.RelativeItem().Element(c => ComposeSummaryCard(c, "Total Plays", report.TotalPlays.ToString("N0"), PrimaryColor));
                row.ConstantItem(10);
                row.RelativeItem().Element(c => ComposeSummaryCard(c, "Full Plays", report.FullPlays.ToString("N0"), SecondaryColor));
                row.ConstantItem(10);
                row.RelativeItem().Element(c => ComposeSummaryCard(c, "Completion Rate", $"{report.CompletionRate}%", AccentColor));
                row.ConstantItem(10);
                row.RelativeItem().Element(c => ComposeSummaryCard(c, "Partial Plays", report.PartialPlays.ToString("N0"), "#EF4444"));
            });

            col.Item().PaddingVertical(20);

            // Per-Screen Stats Table
            col.Item().Text("Performance by Screen").FontSize(14).Bold();
            col.Item().PaddingVertical(5);
            
            var screenStats = report.ScreenStats ?? new List<ScreenSummary>();
            col.Item().Element(c => ComposeScreenTable(c, screenStats));
        });
    }

    private void ComposeSummaryCard(IContainer container, string label, string value, string color)
    {
        container.Border(1).BorderColor(Color.FromHex(color)).Background(Colors.White).Padding(12).Column(col =>
        {
            col.Item().Text(label).FontSize(9).FontColor(Color.FromHex("#6B7280"));
            col.Item().Text(value).FontSize(20).Bold().FontColor(Color.FromHex(color));
        });
    }

    private void ComposeDailyChart(IContainer container, List<DailyBreakdown> data)
    {
        if (!data.Any()) return;

        var maxPlays = data.Max(d => d.TotalPlays);
        if (maxPlays == 0) maxPlays = 1;

        container.Height(100).Row(row =>
        {
            foreach (var day in data.TakeLast(14)) // Show last 14 days
            {
                row.RelativeItem().Column(col =>
                {
                    var barHeight = (int)(80 * day.TotalPlays / (double)maxPlays);
                    
                    col.Item().AlignBottom().Height(80).AlignBottom()
                        .Width(20)
                        .Height(Math.Max(barHeight, 2))
                        .Background(Color.FromHex(PrimaryColor));
                        
                    col.Item().AlignCenter().Text(day.Date.ToString("dd")).FontSize(7);
                });
            }
        });
    }

    private void ComposeDailyTable(IContainer container, List<DailyBreakdown> data)
    {
        if (data == null || !data.Any())
        {
            container.Text("No daily data available").FontSize(10).FontColor(Color.FromHex("#6B7280"));
            return;
        }
        
        container.Table(table =>
        {
            table.ColumnsDefinition(cols =>
            {
                cols.RelativeColumn(2); // Date
                cols.RelativeColumn(1); // Total Plays
                cols.RelativeColumn(1); // Full Plays
                cols.RelativeColumn(1); // Partial
                cols.RelativeColumn(1.5f); // Duration
                cols.RelativeColumn(1); // Completion
            });

            // Header
            table.Header(header =>
            {
                header.Cell().Background(Color.FromHex(PrimaryColor)).Padding(5)
                    .Text("Date").FontColor(Colors.White).Bold();
                header.Cell().Background(Color.FromHex(PrimaryColor)).Padding(5)
                    .Text("Total").FontColor(Colors.White).Bold();
                header.Cell().Background(Color.FromHex(PrimaryColor)).Padding(5)
                    .Text("Full").FontColor(Colors.White).Bold();
                header.Cell().Background(Color.FromHex(PrimaryColor)).Padding(5)
                    .Text("Partial").FontColor(Colors.White).Bold();
                header.Cell().Background(Color.FromHex(PrimaryColor)).Padding(5)
                    .Text("Duration").FontColor(Colors.White).Bold();
                header.Cell().Background(Color.FromHex(PrimaryColor)).Padding(5)
                    .Text("Rate").FontColor(Colors.White).Bold();
            });

            // Rows
            foreach (var day in data)
            {
                var bgColor = data.IndexOf(day) % 2 == 0 ? Colors.White : Color.FromHex(LightGray);
                
                table.Cell().Background(bgColor).Padding(5).Text(day.Date.ToString("MMM dd, yyyy"));
                table.Cell().Background(bgColor).Padding(5).AlignRight().Text(day.TotalPlays.ToString("N0"));
                table.Cell().Background(bgColor).Padding(5).AlignRight().Text(day.FullPlays.ToString("N0"));
                table.Cell().Background(bgColor).Padding(5).AlignRight().Text(day.PartialPlays.ToString("N0"));
                table.Cell().Background(bgColor).Padding(5).AlignRight().Text(FormatDuration(day.TotalDurationSeconds));
                table.Cell().Background(bgColor).Padding(5).AlignRight()
                    .Text($"{day.CompletionRate}%")
                    .FontColor(Color.FromHex(day.CompletionRate >= 90 ? SecondaryColor : day.CompletionRate >= 70 ? "#F59E0B" : "#EF4444"));
            }
        });
    }

    private void ComposeScreenTable(IContainer container, List<ScreenSummary> data)
    {
        if (data == null || !data.Any())
        {
            container.Text("No screen data available").FontSize(10).FontColor(Color.FromHex("#6B7280"));
            return;
        }
        
        container.Table(table =>
        {
            table.ColumnsDefinition(cols =>
            {
                cols.RelativeColumn(2); // Screen Name
                cols.RelativeColumn(1.5f); // Location
                cols.RelativeColumn(1); // Total Plays
                cols.RelativeColumn(1); // Full Plays
                cols.RelativeColumn(1); // Completion
            });

            // Header
            table.Header(header =>
            {
                header.Cell().Background(Color.FromHex(PrimaryColor)).Padding(5)
                    .Text("Screen").FontColor(Colors.White).Bold();
                header.Cell().Background(Color.FromHex(PrimaryColor)).Padding(5)
                    .Text("Location").FontColor(Colors.White).Bold();
                header.Cell().Background(Color.FromHex(PrimaryColor)).Padding(5)
                    .Text("Total").FontColor(Colors.White).Bold();
                header.Cell().Background(Color.FromHex(PrimaryColor)).Padding(5)
                    .Text("Full").FontColor(Colors.White).Bold();
                header.Cell().Background(Color.FromHex(PrimaryColor)).Padding(5)
                    .Text("Rate").FontColor(Colors.White).Bold();
            });

            // Rows
            foreach (var screen in data)
            {
                var bgColor = data.IndexOf(screen) % 2 == 0 ? Colors.White : Color.FromHex(LightGray);
                
                table.Cell().Background(bgColor).Padding(5).Text(screen.ScreenName ?? "Unknown");
                table.Cell().Background(bgColor).Padding(5).Text(screen.ScreenLocation ?? "Unknown");
                table.Cell().Background(bgColor).Padding(5).AlignRight().Text(screen.TotalPlays.ToString("N0"));
                table.Cell().Background(bgColor).Padding(5).AlignRight().Text(screen.FullPlays.ToString("N0"));
                table.Cell().Background(bgColor).Padding(5).AlignRight()
                    .Text($"{screen.CompletionRate}%")
                    .FontColor(Color.FromHex(screen.CompletionRate >= 90 ? SecondaryColor : screen.CompletionRate >= 70 ? "#F59E0B" : "#EF4444"));
            }
        });
    }

    private void ComposeFooter(IContainer container)
    {
        container.AlignCenter().Text(text =>
        {
            text.Span("PixelSpot - ").FontColor(Color.FromHex("#6B7280"));
            text.Span("Transparent & Verified Advertising").FontColor(Color.FromHex(PrimaryColor));
            text.Span(" | Page ").FontColor(Color.FromHex("#6B7280"));
            text.CurrentPageNumber();
            text.Span(" of ");
            text.TotalPages();
        });
    }

    private string FormatDuration(int totalSeconds)
    {
        var hours = totalSeconds / 3600;
        var minutes = (totalSeconds % 3600) / 60;
        var seconds = totalSeconds % 60;

        if (hours > 0)
            return $"{hours}h {minutes}m";
        if (minutes > 0)
            return $"{minutes}m {seconds}s";
        return $"{seconds}s";
    }

    #endregion

    #region Screen Health Report

    public record ScreenHealthRow(
        string Name,
        string? LocationTag,
        string Status,
        string LastSeenAt,
        string CurrentPlaylist);

    public byte[] ExportScreenHealthReportToPdf(List<ScreenHealthRow> rows)
    {
        try
        {
            var generatedAt = DateTime.UtcNow;
            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(40);
                    page.DefaultTextStyle(x => x.FontSize(10).FontColor(Color.FromHex(TextColor)));

                    page.Header().Element(c => ComposeHeader(c, "Screen Health Report"));

                    page.Content().Column(col =>
                    {
                        col.Item().PaddingBottom(8).Row(row =>
                        {
                            row.RelativeItem().Text($"Generated: {generatedAt:yyyy-MM-dd HH:mm} UTC")
                                .FontSize(9).FontColor(Color.FromHex("#6B7280"));
                            row.RelativeItem().AlignRight().Text($"Total screens: {rows.Count}")
                                .FontSize(9).FontColor(Color.FromHex("#6B7280"));
                        });

                        // Summary row
                        var onlineCount = rows.Count(r => r.Status == "online");
                        var staleCount = rows.Count(r => r.Status == "stale");
                        var offlineCount = rows.Count(r => r.Status == "offline");

                        col.Item().PaddingBottom(16).Row(row =>
                        {
                            row.RelativeItem().Background(Color.FromHex("#DCFCE7")).Padding(8).Text(
                                $"Online: {onlineCount}").FontSize(11).Bold().FontColor(Color.FromHex("#166534"));
                            row.ConstantItem(8);
                            row.RelativeItem().Background(Color.FromHex("#FEF9C3")).Padding(8).Text(
                                $"Stale: {staleCount}").FontSize(11).Bold().FontColor(Color.FromHex("#713F12"));
                            row.ConstantItem(8);
                            row.RelativeItem().Background(Color.FromHex("#FEE2E2")).Padding(8).Text(
                                $"Offline: {offlineCount}").FontSize(11).Bold().FontColor(Color.FromHex("#991B1B"));
                        });

                        // Table header
                        col.Item().Table(table =>
                        {
                            table.ColumnsDefinition(cols =>
                            {
                                cols.RelativeColumn(3);   // Name
                                cols.RelativeColumn(2);   // Location
                                cols.RelativeColumn(1.2f); // Status
                                cols.RelativeColumn(2);   // Last Seen
                                cols.RelativeColumn(3);   // Playlist
                            });

                            // Header row
                            static IContainer HeaderCell(IContainer c) =>
                                c.Background(Color.FromHex("#1E293B")).Padding(6);

                            table.Header(header =>
                            {
                                header.Cell().Element(HeaderCell).Text("Screen Name").Bold()
                                    .FontColor(Colors.White).FontSize(9);
                                header.Cell().Element(HeaderCell).Text("Location").Bold()
                                    .FontColor(Colors.White).FontSize(9);
                                header.Cell().Element(HeaderCell).Text("Status").Bold()
                                    .FontColor(Colors.White).FontSize(9);
                                header.Cell().Element(HeaderCell).Text("Last Seen").Bold()
                                    .FontColor(Colors.White).FontSize(9);
                                header.Cell().Element(HeaderCell).Text("Current Playlist").Bold()
                                    .FontColor(Colors.White).FontSize(9);
                            });

                            // Data rows
                            for (var i = 0; i < rows.Count; i++)
                            {
                                var r = rows[i];
                                var bg = i % 2 == 0 ? Colors.White : Color.FromHex(LightGray);
                                var statusColor = r.Status switch
                                {
                                    "online" => "#166534",
                                    "stale" => "#713F12",
                                    _ => "#991B1B"
                                };

                                IContainer DataCell(IContainer c) => c.Background(bg).Padding(5);

                                table.Cell().Element(DataCell).Text(r.Name).FontSize(9);
                                table.Cell().Element(DataCell).Text(r.LocationTag ?? "—").FontSize(9)
                                    .FontColor(Color.FromHex("#6B7280"));
                                table.Cell().Element(DataCell).Text(r.Status.ToUpper()).FontSize(9)
                                    .Bold().FontColor(Color.FromHex(statusColor));
                                table.Cell().Element(DataCell).Text(r.LastSeenAt).FontSize(9);
                                table.Cell().Element(DataCell).Text(r.CurrentPlaylist).FontSize(9);
                            }
                        });
                    });

                    page.Footer().Element(ComposeFooter);
                });
            });

            return document.GeneratePdf();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating screen health PDF: {Message}", ex.Message);
            throw;
        }
    }

    /// <summary>
    /// The client-ready screen-plan proposal: summary, per-screen spec cards
    /// (specs, audience, footfall, engine-priced estimates), creative spec
    /// sheet, and the proof promise. Prices come from the same BookingCalculation
    /// engine that bills real bookings, so this document always equals checkout.
    /// </summary>
    public byte[] ExportProposalToPdf(
        CCMS.Api.Controllers.ProposalPlan plan,
        IReadOnlyDictionary<Guid, List<byte[]>>? screenImages = null)
    {
        string Money(decimal v) => $"{plan.Currency} {v:N0}";
        // "RetailStore" -> "Retail store" for buyer-facing venue labels.
        static string Humanize(string enumName) =>
            string.Concat(enumName.Select((ch, i) =>
                i > 0 && char.IsUpper(ch) ? " " + char.ToLower(ch) : ch.ToString()));
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(x => x.FontSize(10).FontColor(Color.FromHex(TextColor)));
                page.Header().Element(c => ComposeHeader(c, "Media Plan"));
                page.Footer().Element(ComposeFooter);

                page.Content().Column(col =>
                {
                    col.Spacing(12);

                    // Cover block
                    col.Item().Column(c =>
                    {
                        if (!string.IsNullOrEmpty(plan.PreparedFor))
                            c.Item().Text($"Prepared for {plan.PreparedFor}").FontSize(13).SemiBold();
                        c.Item().Text($"Flight: {plan.From:dd MMM yyyy} – {plan.To:dd MMM yyyy}  ({plan.Days} days)").FontSize(11);
                        c.Item().Text($"Generated {plan.GeneratedAt:dd MMM yyyy HH:mm} UTC · Prices held for 7 days, subject to slot availability at booking time.")
                            .FontSize(8).FontColor(Color.FromHex("#6B7280"));
                    });

                    // Plan summary
                    col.Item().Background(Color.FromHex("#F5F3FF")).Padding(10).Row(r =>
                    {
                        void Cell(QuestPDF.Infrastructure.IContainer c2, string label, string value)
                        {
                            c2.Column(cc =>
                            {
                                cc.Item().Text(label).FontSize(7).FontColor(Color.FromHex("#6B7280"));
                                cc.Item().Text(value).FontSize(12).SemiBold().FontColor(Color.FromHex(AccentColor));
                            });
                        }
                        Cell(r.RelativeItem(), "SCREENS", plan.Screens.Count.ToString());
                        Cell(r.RelativeItem(), "EST. FOOTFALL / DAY*", plan.TotalFootfallPerDay.ToString("N0"));
                        Cell(r.RelativeItem(), "EST. PLAYS (FLIGHT)", plan.TotalEstPlays.ToString("N0"));
                        Cell(r.RelativeItem(), "EST. TOTAL", Money(plan.TotalEstCost));
                    });

                    // Per-screen spec cards
                    foreach (var s2 in plan.Screens)
                    {
                        col.Item().Border(1).BorderColor(Color.FromHex("#E5E7EB")).Padding(10).Column(card =>
                        {
                            card.Spacing(4);
                            var location = string.Join(", ", new[] { s2.City, s2.State }
                                .Where(x => !string.IsNullOrWhiteSpace(x)));
                            card.Item().Row(r =>
                            {
                                r.RelativeItem().Text(location.Length > 0 ? $"{s2.Name} — {location}" : s2.Name)
                                    .FontSize(11).SemiBold();
                                r.ConstantItem(120).AlignRight().Text(Money(s2.EstCost)).FontSize(11).SemiBold()
                                    .FontColor(Color.FromHex(AccentColor));
                            });
                            card.Item().Row(r =>
                            {
                                var photos = screenImages != null && screenImages.TryGetValue(s2.ScreenId, out var pb)
                                    ? pb : null;
                                if (photos is { Count: > 0 })
                                {
                                    // Screen photo + surrounding shot, downsampled at render time
                                    // so a 20-screen plan stays a sane file size.
                                    foreach (var photo in photos.Take(2))
                                    {
                                        r.ConstantItem(104).PaddingRight(6).Column(pc =>
                                            pc.Item().Height(70).Image(photo)
                                                .FitArea()
                                                .WithCompressionQuality(ImageCompressionQuality.Medium)
                                                .WithRasterDpi(120));
                                    }
                                }
                                r.RelativeItem().Column(info =>
                                {
                                    info.Spacing(3);
                                    var venueParts = new List<string>();
                                    if (!string.IsNullOrWhiteSpace(s2.VenueType))
                                        venueParts.Add($"Venue: {Humanize(s2.VenueType)}");
                                    venueParts.Add(Humanize(s2.Environment));
                                    venueParts.Add(s2.Orientation.ToLowerInvariant() + " orientation");
                                    info.Item().Text(string.Join(" · ", venueParts))
                                        .FontSize(8.5f).SemiBold().FontColor(Color.FromHex("#374151"));
                                    var specParts = new List<string> { Humanize(s2.ScreenType) };
                                    if (s2.ResolutionWidth > 0 && s2.ResolutionHeight > 0)
                                        specParts.Add($"{s2.ResolutionWidth}×{s2.ResolutionHeight}px");
                                    if (!string.IsNullOrWhiteSpace(s2.PhysicalSize) && s2.PhysicalSize != "—")
                                        specParts.Add(s2.PhysicalSize);
                                    info.Item().Text(string.Join(" · ", specParts.Where(x => !string.IsNullOrWhiteSpace(x))))
                                        .FontSize(8.5f).FontColor(Color.FromHex("#4B5563"));
                                    if (!string.IsNullOrWhiteSpace(s2.Description))
                                    {
                                        var desc = s2.Description.Trim();
                                        if (desc.Length > 260) desc = desc[..257] + "…";
                                        info.Item().Text(desc).FontSize(8).Italic()
                                            .FontColor(Color.FromHex("#6B7280"));
                                    }
                                    if (s2.Tags.Count > 0)
                                        info.Item().Text("Tags: " + string.Join(", ", s2.Tags))
                                            .FontSize(8).FontColor(Color.FromHex("#6D28D9"));
                                });
                            });
                            card.Item().Text(
                                (s2.SlotSeconds > 0 ? $"Slot: {s2.SlotSeconds}s per loop · " : "") +
                                $"{plan.Currency} {s2.PricePerSlot:0.##}/slot base · " +
                                $"Est. plays: {s2.EstPlays:N0} over {s2.AvailableDays}/{s2.TotalDays} available days · " +
                                $"Footfall*: {s2.DailyFootfall:N0}/day · Audience score: {s2.Aqs:0.#}/100")
                                .FontSize(8.5f).FontColor(Color.FromHex("#4B5563"));
                        });
                    }

                    // Creative spec sheet
                    col.Item().PaddingTop(4).Column(c =>
                    {
                        c.Item().Text("Creative specifications").FontSize(11).SemiBold();
                        c.Item().Text(
                            "Formats: MP4 / WebM video, JPEG / PNG / WebP image · up to 100 MB per creative. " +
                            "Any resolution is accepted — the platform fits your creative to every screen " +
                            "automatically (no black bars, no redesign). Videos play their own length up to the " +
                            "slot duration shown per screen; images display for the full slot.")
                            .FontSize(8.5f).FontColor(Color.FromHex("#4B5563"));
                    });

                    // Proof promise
                    col.Item().Background(Color.FromHex("#ECFDF5")).Padding(10).Column(c =>
                    {
                        c.Item().Text("Every play, proven").FontSize(11).SemiBold().FontColor(Color.FromHex("#047857"));
                        c.Item().Text(
                            "PixelSpot campaigns come with a live play counter, delivery-linked billing (you pay only " +
                            "for plays that actually air), and cryptographically sealed play logs — every impression is " +
                            "hashed on the screen device the moment it airs and chained into daily tamper-evident seals " +
                            "you can verify independently, offline.")
                            .FontSize(8.5f).FontColor(Color.FromHex("#065F46"));
                    });

                    col.Item().Text("*Footfall figures are owner-declared daily audience estimates, not measured counts.")
                        .FontSize(7).FontColor(Color.FromHex("#9CA3AF"));
                });
            });
        });
        return document.GeneratePdf();
    }

    #endregion
}
