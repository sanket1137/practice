using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CCMS.Infrastructure.Data;

/// <summary>
/// Lets `dotnet ef migrations add` build the DbContext without booting the full
/// API host — which refuses to start without production secrets (JWT key, R2
/// credentials, ...) that have no business existing on a dev machine just to
/// generate a migration. Model shape doesn't depend on a live database; the
/// connection string here is only used if you explicitly run
/// `dotnet ef database update` locally (override via ConnectionStrings__PostgresConnection).
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__PostgresConnection")
            ?? "Host=localhost;Database=ccms;Username=postgres;Password=postgres";

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new ApplicationDbContext(options);
    }
}
