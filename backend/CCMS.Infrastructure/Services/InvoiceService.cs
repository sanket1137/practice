using CCMS.Application.Interfaces;
using CCMS.Shared.DTOs.Bookings;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Globalization;

namespace CCMS.Infrastructure.Services;

public class InvoiceService : IInvoiceService
{
    private readonly ILogger<InvoiceService> _logger;
    private readonly string _gstin;
    private readonly string _hsn;
    private readonly decimal _taxRate;

    public InvoiceService(ILogger<InvoiceService> logger, IConfiguration configuration)
    {
        _logger = logger;
        _gstin = configuration["Platform:GSTIN"] ?? "";
        _hsn = configuration["Platform:HSN"] ?? "998366";
        _taxRate = decimal.TryParse(configuration["Platform:TaxRate"], out var rate) ? rate : 18m;
        // Set QuestPDF license (Community license is free for small businesses)
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public Task<byte[]> GenerateBookingInvoiceAsync(
        BookingDto booking,
        string advertiserName,
        string advertiserEmail,
        string screenOwnerName)
    {
        _logger.LogInformation("Generating invoice for booking {BookingId}", booking.Id);

        var invoiceNumber = GenerateInvoiceNumber(booking.Id, booking.CreatedAt);
        var document = CreateInvoiceDocument(booking, advertiserName, advertiserEmail, screenOwnerName, invoiceNumber);
        
        var pdfBytes = document.GeneratePdf();
        
        _logger.LogInformation("Invoice {InvoiceNumber} generated successfully, size: {Size} bytes", 
            invoiceNumber, pdfBytes.Length);

        return Task.FromResult(pdfBytes);
    }

    public string GenerateInvoiceNumber(Guid bookingId, DateTime createdAt)
    {
        // Format: INV-YYYYMMDD-XXXXX (last 5 chars of booking ID)
        var shortId = bookingId.ToString().Substring(0, 8).ToUpperInvariant();
        return $"INV-{createdAt:yyyyMMdd}-{shortId}";
    }

    private Document CreateInvoiceDocument(
        BookingDto booking,
        string advertiserName,
        string advertiserEmail,
        string screenOwnerName,
        string invoiceNumber)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Element(c => ComposeHeader(c, invoiceNumber));
                page.Content().Element(c => ComposeContent(c, booking, advertiserName, advertiserEmail, screenOwnerName));
                page.Footer().Element(ComposeFooter);
            });
        });
    }

    private void ComposeHeader(IContainer container, string invoiceNumber)
    {
        container.Row(row =>
        {
            row.RelativeItem().Column(column =>
            {
                column.Item()
                    .Text("PIXELSPOT")
                    .Bold()
                    .FontSize(24)
                    .FontColor(Colors.Blue.Darken2);

                column.Item()
                    .Text("Digital Signage Advertising Platform")
                    .FontSize(10)
                    .FontColor(Colors.Grey.Darken1);
            });

            row.ConstantItem(150).Column(column =>
            {
                column.Item()
                    .AlignRight()
                    .Text("INVOICE")
                    .Bold()
                    .FontSize(20)
                    .FontColor(Colors.Grey.Darken2);

                column.Item()
                    .AlignRight()
                    .Text(invoiceNumber)
                    .FontSize(12)
                    .FontColor(Colors.Blue.Darken1);

                column.Item()
                    .AlignRight()
                    .Text($"Date: {DateTime.UtcNow:MMM dd, yyyy}")
                    .FontSize(9)
                    .FontColor(Colors.Grey.Darken1);
            });
        });
    }

    private void ComposeContent(
        IContainer container,
        BookingDto booking,
        string advertiserName,
        string advertiserEmail,
        string screenOwnerName)
    {
        container.PaddingVertical(20).Column(column =>
        {
            column.Spacing(15);

            // Bill To / From Section
            column.Item().Row(row =>
            {
                row.RelativeItem().Column(billTo =>
                {
                    billTo.Item()
                        .Text("BILL TO")
                        .Bold()
                        .FontSize(9)
                        .FontColor(Colors.Grey.Darken1);

                    billTo.Item().PaddingTop(5)
                        .Text(advertiserName)
                        .Bold()
                        .FontSize(11);

                    billTo.Item()
                        .Text(advertiserEmail)
                        .FontSize(9)
                        .FontColor(Colors.Grey.Darken1);
                });

                row.RelativeItem().Column(provider =>
                {
                    provider.Item()
                        .AlignRight()
                        .Text("SCREEN OWNER")
                        .Bold()
                        .FontSize(9)
                        .FontColor(Colors.Grey.Darken1);

                    provider.Item().PaddingTop(5)
                        .AlignRight()
                        .Text(screenOwnerName)
                        .Bold()
                        .FontSize(11);
                });
            });

            // Booking Details Section
            column.Item().PaddingTop(10).Element(ComposeBookingDetailsSection);

            void ComposeBookingDetailsSection(IContainer container)
            {
                container.Column(col =>
                {
                    col.Item()
                        .BorderBottom(1)
                        .BorderColor(Colors.Grey.Lighten2)
                        .PaddingBottom(5)
                        .Text("BOOKING DETAILS")
                        .Bold()
                        .FontSize(11)
                        .FontColor(Colors.Grey.Darken2);

                    col.Item().PaddingTop(10).Row(row =>
                    {
                        row.RelativeItem().Column(leftCol =>
                        {
                            ComposeDetailRow(leftCol, "Booking ID:", booking.Id.ToString().Substring(0, 8).ToUpperInvariant());
                            ComposeDetailRow(leftCol, "Campaign:", booking.CampaignName);
                            ComposeDetailRow(leftCol, "Screen:", booking.ScreenName);
                            ComposeDetailRow(leftCol, "Creative:", booking.CreativeName);
                        });

                        row.RelativeItem().Column(rightCol =>
                        {
                            var startDateParsed = DateOnly.Parse(booking.StartDate);
                            var endDateParsed = DateOnly.Parse(booking.EndDate);
                            ComposeDetailRow(rightCol, "Start Date:", startDateParsed.ToString("MMM dd, yyyy", CultureInfo.InvariantCulture));
                            ComposeDetailRow(rightCol, "End Date:", endDateParsed.ToString("MMM dd, yyyy", CultureInfo.InvariantCulture));
                            ComposeDetailRow(rightCol, "Status:", booking.Status);
                            if (booking.ApprovedAt.HasValue)
                            {
                                ComposeDetailRow(rightCol, "Approved:", booking.ApprovedAt.Value.ToString("MMM dd, yyyy"));
                            }
                        });
                    });
                });
            }

            // Slot Information
            column.Item().Element(ComposeSlotInfoSection);

            void ComposeSlotInfoSection(IContainer container)
            {
                container.Column(col =>
                {
                    col.Item()
                        .BorderBottom(1)
                        .BorderColor(Colors.Grey.Lighten2)
                        .PaddingBottom(5)
                        .Text("SLOT INFORMATION")
                        .Bold()
                        .FontSize(11)
                        .FontColor(Colors.Grey.Darken2);

                    col.Item().PaddingTop(10).Row(row =>
                    {
                        row.RelativeItem().Column(slotCol =>
                        {
                            var slotNumbers = booking.SlotNumbers?.Any() == true
                                ? string.Join(", ", booking.SlotNumbers.Select(s => $"Slot {s}"))
                                : "All available slots";

                            ComposeDetailRow(slotCol, "Slots Booked:", slotNumbers);
                            ComposeDetailRow(slotCol, "Expected Impressions:", booking.ExpectedImpressions.ToString("N0"));
                            ComposeDetailRow(slotCol, "Delivered Impressions:", booking.DeliveredImpressions.ToString("N0"));
                        });

                        row.RelativeItem().Column(durationCol =>
                        {
                            var startDate = DateOnly.Parse(booking.StartDate);
                            var endDate = DateOnly.Parse(booking.EndDate);
                            var duration = endDate.DayNumber - startDate.DayNumber + 1;
                            ComposeDetailRow(durationCol, "Duration:", $"{duration} day(s)");
                            
                            if (booking.BookedDates?.Any() == true)
                            {
                                ComposeDetailRow(durationCol, "Booked Dates:", $"{booking.BookedDates.Count} date(s)");
                            }
                        });
                    });
                });
            }

            // Pricing Table
            column.Item().PaddingTop(10).Element(ComposePricingTable);

            void ComposePricingTable(IContainer container)
            {
                container.Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.RelativeColumn(3);
                        columns.RelativeColumn();
                        columns.RelativeColumn();
                        columns.RelativeColumn();
                    });

                    // Header
                    table.Header(header =>
                    {
                        header.Cell().Background(Colors.Grey.Lighten3).Padding(8).Text("Description").Bold();
                        header.Cell().Background(Colors.Grey.Lighten3).Padding(8).AlignRight().Text("Duration").Bold();
                        header.Cell().Background(Colors.Grey.Lighten3).Padding(8).AlignRight().Text("Rate").Bold();
                        header.Cell().Background(Colors.Grey.Lighten3).Padding(8).AlignRight().Text("Amount").Bold();
                    });

                    // Data row
                    var pricingStartDate = DateOnly.Parse(booking.StartDate);
                    var pricingEndDate = DateOnly.Parse(booking.EndDate);
                    var duration = pricingEndDate.DayNumber - pricingStartDate.DayNumber + 1;
                    var dailyRate = booking.TotalPrice / duration;

                    table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(8)
                        .Text($"Screen Advertising - {booking.ScreenName}");
                    table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(8)
                        .AlignRight().Text($"{duration} day(s)");
                    table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(8)
                        .AlignRight().Text($"{booking.Currency} {dailyRate:N2}/day");
                    table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(8)
                        .AlignRight().Text($"{booking.Currency} {booking.TotalPrice:N2}");

                    // Slot details row
                    var slotCount = booking.SlotNumbers?.Count ?? 0;
                    if (slotCount > 0)
                    {
                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(8)
                            .Text(text => text.Span($"  └ {slotCount} slot(s): {string.Join(", ", booking.SlotNumbers!.Select(s => $"#{s}"))}").FontColor(Colors.Grey.Darken1));
                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(8).Text("");
                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(8).Text("");
                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(8).Text("");
                    }
                });
            }

            // Total Section with GST breakdown
            column.Item().AlignRight().PaddingTop(10).Row(row =>
            {
                row.ConstantItem(250).Column(totalCol =>
                {
                    totalCol.Item().Row(r =>
                    {
                        r.RelativeItem().Text("Subtotal:").AlignRight();
                        r.ConstantItem(120).Text($"{booking.Currency} {booking.TotalPrice:N2}").AlignRight();
                    });

                    var halfTax = _taxRate / 2m;
                    var cgst = booking.TotalPrice * halfTax / 100m;
                    var sgst = cgst;
                    var totalWithTax = booking.TotalPrice + cgst + sgst;

                    if (!string.IsNullOrEmpty(_gstin))
                    {
                        totalCol.Item().PaddingTop(2).Row(r =>
                        {
                            r.RelativeItem().Text($"CGST ({halfTax:N1}%):").AlignRight().FontColor(Colors.Grey.Darken1);
                            r.ConstantItem(120).Text($"{booking.Currency} {cgst:N2}").AlignRight().FontColor(Colors.Grey.Darken1);
                        });

                        totalCol.Item().PaddingTop(2).Row(r =>
                        {
                            r.RelativeItem().Text($"SGST ({halfTax:N1}%):").AlignRight().FontColor(Colors.Grey.Darken1);
                            r.ConstantItem(120).Text($"{booking.Currency} {sgst:N2}").AlignRight().FontColor(Colors.Grey.Darken1);
                        });
                    }
                    else
                    {
                        totalCol.Item().Row(r =>
                        {
                            r.RelativeItem().Text("Tax (0%):").AlignRight().FontColor(Colors.Grey.Darken1);
                            r.ConstantItem(120).Text($"{booking.Currency} 0.00").AlignRight().FontColor(Colors.Grey.Darken1);
                        });
                        totalWithTax = booking.TotalPrice;
                    }

                    totalCol.Item().PaddingTop(5).BorderTop(2).BorderColor(Colors.Blue.Darken2).PaddingTop(5).Row(r =>
                    {
                        r.RelativeItem().Text("TOTAL DUE:").Bold().FontSize(12).AlignRight();
                        r.ConstantItem(120).Text($"{booking.Currency} {totalWithTax:N2}")
                            .Bold().FontSize(12).FontColor(Colors.Blue.Darken2).AlignRight();
                    });

                    if (!string.IsNullOrEmpty(_gstin))
                    {
                        totalCol.Item().PaddingTop(5).Row(r =>
                        {
                            r.RelativeItem().Text($"GSTIN: {_gstin}  |  HSN: {_hsn}")
                                .FontSize(8).FontColor(Colors.Grey.Darken1).AlignRight();
                        });
                    }
                });
            });

            // Notes Section
            column.Item().PaddingTop(30).Element(ComposeNotesSection);

            void ComposeNotesSection(IContainer container)
            {
                container.Background(Colors.Grey.Lighten4).Padding(15).Column(notesCol =>
                {
                    notesCol.Item().Text("NOTES").Bold().FontSize(9).FontColor(Colors.Grey.Darken1);
                    notesCol.Item().PaddingTop(5).Text("• Payment is due within 30 days of invoice date.")
                        .FontSize(9).FontColor(Colors.Grey.Darken2);
                    notesCol.Item().Text("• Impressions are tracked automatically and updated in real-time.")
                        .FontSize(9).FontColor(Colors.Grey.Darken2);
                    notesCol.Item().Text("• For questions regarding this invoice, please contact support@pixelspot.com")
                        .FontSize(9).FontColor(Colors.Grey.Darken2);
                });
            }
        });
    }

    private void ComposeDetailRow(ColumnDescriptor column, string label, string value)
    {
        column.Item().PaddingBottom(3).Row(row =>
        {
            row.ConstantItem(120).Text(label).FontColor(Colors.Grey.Darken1);
            row.RelativeItem().Text(value);
        });
    }

    private void ComposeFooter(IContainer container)
    {
        container.Column(column =>
        {
            column.Item()
                .BorderTop(1)
                .BorderColor(Colors.Grey.Lighten2)
                .PaddingTop(10)
                .Row(row =>
                {
                    row.RelativeItem().Text(text =>
                    {
                        text.Span("Generated by PixelSpot CCMS • ")
                            .FontSize(8)
                            .FontColor(Colors.Grey.Darken1);
                        text.Span($"{DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC")
                            .FontSize(8)
                            .FontColor(Colors.Grey.Darken1);
                    });

                    row.RelativeItem().AlignRight().Text(text =>
                    {
                        text.Span("Page ")
                            .FontSize(8)
                            .FontColor(Colors.Grey.Darken1);
                        text.CurrentPageNumber()
                            .FontSize(8)
                            .FontColor(Colors.Grey.Darken1);
                        text.Span(" of ")
                            .FontSize(8)
                            .FontColor(Colors.Grey.Darken1);
                        text.TotalPages()
                            .FontSize(8)
                            .FontColor(Colors.Grey.Darken1);
                    });
                });
        });
    }
}
