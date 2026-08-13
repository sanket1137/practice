using CCMS.Domain.Entities;
using CCMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CCMS.Infrastructure.Data;

public static class FestivalSeeder
{
    public static async Task SeedAsync(ApplicationDbContext context)
    {
        var existing = await context.FestivalEntries.AnyAsync();
        if (existing) return;

        var festivals = new List<FestivalEntry>
        {
            new() { Name = "Republic Day", StartDate = new DateOnly(2026, 1, 26), EndDate = new DateOnly(2026, 1, 26), Year = 2026, Region = "India", SuggestedMultiplier = 1.3m },
            new() { Name = "Valentine'\''s Day", StartDate = new DateOnly(2026, 2, 14), EndDate = new DateOnly(2026, 2, 14), Year = 2026, Region = "India", SuggestedMultiplier = 1.25m },
            new() { Name = "Holi", StartDate = new DateOnly(2026, 3, 3), EndDate = new DateOnly(2026, 3, 4), Year = 2026, Region = "India", SuggestedMultiplier = 1.5m },
            new() { Name = "IPL Season", StartDate = new DateOnly(2026, 3, 20), EndDate = new DateOnly(2026, 5, 31), Year = 2026, Region = "India", SuggestedMultiplier = 1.6m },
            new() { Name = "Eid al-Fitr", StartDate = new DateOnly(2026, 3, 20), EndDate = new DateOnly(2026, 3, 22), Year = 2026, Region = "India", SuggestedMultiplier = 1.4m },
            new() { Name = "Independence Day", StartDate = new DateOnly(2026, 8, 15), EndDate = new DateOnly(2026, 8, 15), Year = 2026, Region = "India", SuggestedMultiplier = 1.3m },
            new() { Name = "Navratri", StartDate = new DateOnly(2026, 10, 9), EndDate = new DateOnly(2026, 10, 18), Year = 2026, Region = "India", SuggestedMultiplier = 1.4m },
            new() { Name = "Dussehra", StartDate = new DateOnly(2026, 10, 19), EndDate = new DateOnly(2026, 10, 19), Year = 2026, Region = "India", SuggestedMultiplier = 1.4m },
            new() { Name = "Diwali", StartDate = new DateOnly(2026, 10, 29), EndDate = new DateOnly(2026, 11, 2), Year = 2026, Region = "India", SuggestedMultiplier = 2.0m },
            new() { Name = "Christmas", StartDate = new DateOnly(2026, 12, 24), EndDate = new DateOnly(2026, 12, 26), Year = 2026, Region = "India", SuggestedMultiplier = 1.4m },
            new() { Name = "New Year'\''s Eve", StartDate = new DateOnly(2026, 12, 31), EndDate = new DateOnly(2026, 12, 31), Year = 2026, Region = "India", SuggestedMultiplier = 1.8m },
        };

        context.FestivalEntries.AddRange(festivals);
        await context.SaveChangesAsync();
    }
}
