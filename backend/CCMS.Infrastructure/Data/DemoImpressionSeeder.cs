using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace CCMS.Infrastructure.Data;

/// <summary>
/// Development-only: backfills realistic play history for seeded bookings so
/// the Monitor Room, Command Center and pacing charts are screenshot-ready
/// the moment the dev stack comes up. Idempotent — runs only when a booking
/// has no impressions at all, and marks its rows as demo via PlayerVersion.
/// Never wired in production (see Program.cs seeding block).
/// </summary>
public static class DemoImpressionSeeder
{
    private const string DemoMarker = "demo-seed";

    // Hour-of-day audience curve (relative weights): quiet nights, morning
    // and evening peaks — makes the hourly charts look like a real venue.
    private static readonly double[] HourWeights =
    {
        0.1, 0.05, 0.05, 0.05, 0.1, 0.3, 0.7, 1.2, 1.6, 1.4, 1.2, 1.3,
        1.5, 1.3, 1.1, 1.2, 1.5, 1.9, 2.2, 2.1, 1.7, 1.2, 0.7, 0.3,
    };

    public static async Task SeedAsync(ApplicationDbContext context)
    {
        // Approved/active bookings whose flight overlaps the last 7 days.
        var since = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(-7));
        var todayDo = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var bookings = await context.Bookings
            .Include(b => b.Screen)
            .Where(b => !b.IsDeleted
                        && (b.Status == BookingStatus.Active || b.Status == BookingStatus.Approved
                            || b.Status == BookingStatus.Completed)
                        && b.StartDate <= todayDo && b.EndDate >= since)
            .ToListAsync();
        if (bookings.Count == 0) return;

        var bookingIds = bookings.Select(b => b.Id).ToList();
        var withPlays = (await context.Impressions
                .Where(i => i.BookingId != null && bookingIds.Contains(i.BookingId.Value))
                .Select(i => i.BookingId!.Value)
                .Distinct()
                .ToListAsync())
            .ToHashSet();

        var rng = new Random(20260902); // deterministic — reseeding yields the same history
        var added = 0;

        foreach (var booking in bookings)
        {
            if (withPlays.Contains(booking.Id)) continue;

            var flightStartDo = booking.StartDate < since ? since : booking.StartDate;
            var flightEndDo = booking.EndDate < todayDo ? booking.EndDate : todayDo;
            var flightStart = flightStartDo.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var flightEnd = flightEndDo.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var slotSeconds = booking.Screen != null && booking.Screen.SlotsPerFrame > 0
                ? (int)Math.Round(booking.Screen.TimeFrameMinutes * 60.0 / booking.Screen.SlotsPerFrame)
                : 10;

            for (var day = flightStart; day <= flightEnd; day = day.AddDays(1))
            {
                // 140–260 plays/day, scaled by the hour curve; today stops at "now".
                var dailyTarget = 140 + rng.Next(120);
                var weightTotal = HourWeights.Sum();
                var lastHour = day == DateTime.UtcNow.Date ? DateTime.UtcNow.Hour : 23;

                for (var hour = 0; hour <= lastHour; hour++)
                {
                    var target = (int)Math.Round(dailyTarget * HourWeights[hour] / weightTotal);
                    for (var n = 0; n < target; n++)
                    {
                        var playedAt = day.AddHours(hour)
                            .AddSeconds(rng.Next(3600));
                        if (playedAt > DateTime.UtcNow) continue;
                        var fullPlay = rng.NextDouble() > 0.03; // ~3% partials
                        context.Impressions.Add(new Impression
                        {
                            Id = Guid.NewGuid(),
                            BookingId = booking.Id,
                            CampaignId = booking.CampaignId,
                            ScreenId = booking.ScreenId,
                            PlayedAt = playedAt,
                            SessionDate = playedAt.Date,
                            DurationSeconds = fullPlay ? slotSeconds : Math.Max(1, rng.Next(slotSeconds)),
                            ExpectedDurationSeconds = slotSeconds,
                            WasFullPlay = fullPlay,
                            DeviceId = $"demo-device-{booking.ScreenId.ToString()[..8]}",
                            SlotPosition = 1 + rng.Next(Math.Max(1, booking.Screen?.SlotsPerFrame ?? 6)),
                            IsVerified = true,
                            ImpressionId = Guid.NewGuid().ToString(),
                            SlotPlayKey = $"{DemoMarker}-{booking.Id.ToString()[..8]}-{playedAt:yyyyMMddHHmmss}-{n}",
                            PlayerVersion = DemoMarker,
                        });
                        added++;
                    }
                }
            }
        }

        if (added == 0) return;
        await context.SaveChangesAsync();

        // Roll the delivered counters up from the actual seeded rows so every
        // surface (pacing, delivery %) agrees with the play log.
        foreach (var booking in bookings.Where(b => !withPlays.Contains(b.Id)))
        {
            booking.DeliveredImpressions = await context.Impressions
                .CountAsync(i => i.BookingId == booking.Id);
        }
        await context.SaveChangesAsync();
    }
}
