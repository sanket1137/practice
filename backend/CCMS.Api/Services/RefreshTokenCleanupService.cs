using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using CCMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CCMS.Api.Services;

public class RefreshTokenCleanupService : BackgroundService
{
    private readonly ILogger<RefreshTokenCleanupService> _logger;
    private readonly IServiceProvider _serviceProvider;
    private readonly TimeSpan _cleanupInterval = TimeSpan.FromHours(24); // Run daily

    public RefreshTokenCleanupService(
        ILogger<RefreshTokenCleanupService> logger,
        IServiceProvider serviceProvider)
    {
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("RefreshTokenCleanupService started. Running every 24 hours.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupExpiredTokensAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while cleaning up expired refresh tokens");
            }

            // Wait 24 hours before next cleanup
            await Task.Delay(_cleanupInterval, stoppingToken);
        }

        _logger.LogInformation("RefreshTokenCleanupService stopped");
    }

    private async Task CleanupExpiredTokensAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var now = DateTime.UtcNow;
        
        // Find all expired tokens
        var expiredTokens = await context.RefreshTokens
            .Where(t => t.ExpiresAt < now)
            .ToListAsync(cancellationToken);

        if (expiredTokens.Count > 0)
        {
            context.RefreshTokens.RemoveRange(expiredTokens);
            await context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
               "Cleaned up {Count} expired refresh tokens at {Time}",
                expiredTokens.Count,
                DateTime.UtcNow);
        }
        else
        {
            _logger.LogInformation("No expired refresh tokens found at {Time}", DateTime.UtcNow);
        }
    }
}
