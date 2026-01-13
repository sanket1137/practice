using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using CCMS.Infrastructure.Data;
using CCMS.Application.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CCMS.Api.Services;

public class OrphanedBlobCleanupService : BackgroundService
{
    private readonly ILogger<OrphanedBlobCleanupService> _logger;
    private readonly IServiceProvider _serviceProvider;
    private readonly TimeSpan _cleanupInterval = TimeSpan.FromDays(7); // Run weekly
    private const int RETENTION_DAYS = 160; // Keep files for 160 days after campaign ends

    public OrphanedBlobCleanupService(
        ILogger<OrphanedBlobCleanupService> logger,
        IServiceProvider serviceProvider)
    {
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("OrphanedBlobCleanupService started. Running every 7 days.");

        // Wait 1 hour before first run (let application stabilize)
        await Task.Delay(TimeSpan.FromHours(1), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupOrphanedBlobsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while cleaning up orphaned blobs");
            }

            // Wait 7 days before next cleanup
            await Task.Delay(_cleanupInterval, stoppingToken);
        }

        _logger.LogInformation("OrphanedBlobCleanupService stopped");
    }

    private async Task CleanupOrphanedBlobsAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var fileStorage = scope.ServiceProvider.GetRequiredService<IFileStorageService>();

        var cutoffDate = DateTime.UtcNow.AddDays(-RETENTION_DAYS);
        
        // Find creatives that are soft-deleted AND their campaign ended > 160 days ago
        var deletedCreatives = await context.Creatives
            .IgnoreQueryFilters() // Include soft-deleted records
            .Where(c => c.IsDeleted)
            .Include(c => c.Campaign)
            .ToListAsync(cancellationToken);

        var orphanedCount = 0;

        foreach (var creative in deletedCreatives)
        {
            // Check if campaign ended > 160 days ago
            var shouldDelete = false;

            if (creative.Campaign != null)
            {
                if (creative.Campaign.EndDate.HasValue && creative.Campaign.EndDate.Value < cutoffDate)
                {
                    shouldDelete = true;
                }
                else if (!creative.Campaign.EndDate.HasValue && creative.IsDeleted && creative.UpdatedAt.HasValue && creative.UpdatedAt.Value < cutoffDate)
                {
                    // If campaign has no end date, use creative deletion date (UpdatedAt when IsDeleted)
                    shouldDelete = true;
                }
            }
            else if (creative.IsDeleted && creative.UpdatedAt.HasValue && creative.UpdatedAt.Value < cutoffDate)
            {
                // If no campaign association, use deletion date (UpdatedAt when IsDeleted)
                shouldDelete = true;
            }

            if (shouldDelete && !string.IsNullOrEmpty(creative.FileUrl))
            {
                try
                {
                    // Delete from blob storage
                    await fileStorage.DeleteFileAsync(creative.FileUrl);

                    // Permanently delete database record
                    context.Creatives.Remove(creative);

                    orphanedCount++;

                    _logger.LogInformation(
                        "Deleted orphaned blob for creative {CreativeId} (Campaign: {CampaignId}): {FileUrl}",
                        creative.Id, creative.CampaignId, creative.FileUrl);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "Failed to delete orphaned blob for creative {CreativeId}: {FileUrl}",
                        creative.Id, creative.FileUrl);
                }
            }
        }

        if (orphanedCount > 0)
        {
            await context.SaveChangesAsync(cancellationToken);
            _logger.LogInformation(
                "Orphaned blob cleanup completed. Deleted {Count} blobs at {Time}",
                orphanedCount, DateTime.UtcNow);
        }
        else
        {
            _logger.LogInformation("No orphaned blobs found at {Time}", DateTime.UtcNow);
        }
    }
}
