using CCMS.Api.Hubs;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using System.Collections.Concurrent;

namespace CCMS.Api.Services;

public class ImpressionFlushService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ImpressionFlushService> _logger;
    private readonly IConfiguration _configuration;
    private readonly Timer _timer;

    public ImpressionFlushService(
        IServiceProvider serviceProvider,
        ILogger<ImpressionFlushService> logger,
        IConfiguration configuration)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[FLUSH SERVICE] Starting background impression flush service");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var flushIntervalMinutes = _configuration.GetValue<int>("PlaybackSettings:FlushIntervalMinutes", 1);
                await Task.Delay(TimeSpan.FromMinutes(flushIntervalMinutes), stoppingToken);

                await FlushImpressions(stoppingToken);
            }
            catch (TaskCanceledException)
            {
                // Normal when stopping
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[FLUSH SERVICE] Error in flush service");
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); // Wait before retrying
            }
        }

        _logger.LogInformation("[FLUSH SERVICE] Stopping background impression flush service");
    }

    private async Task FlushImpressions(CancellationToken cancellationToken)
    {
        try
        {
            // Get pending impressions from PlaybackHub
            var pendingCount = PlaybackHub.GetPendingCount();
            
            if (pendingCount == 0)
            {
                _logger.LogInformation($"[FLUSH SERVICE] No impressions to flush");
                return;
            }

            Console.WriteLine($"[FLUSH SERVICE] Starting flush of {pendingCount} impressions...");
            _logger.LogInformation($"[FLUSH SERVICE] Starting flush of {pendingCount} impressions...");

            // Take all pending impressions
            var toFlush = new List<Impression>();
            while (PlaybackHub.TryTakePendingImpression(out var impression))
            {
                toFlush.Add(impression);
            }

            if (toFlush.Count == 0)
            {
                return; // Another thread took them all
            }

            // Create a scope to get scoped services (DbContext, etc.)
            using var scope = _serviceProvider.CreateScope();
            var impressionRepository = scope.ServiceProvider.GetRequiredService<IRepository<Impression>>();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            // Batch insert
            foreach (var impression in toFlush)
            {
                await impressionRepository.AddAsync(impression, cancellationToken);
            }

            await unitOfWork.SaveChangesAsync(cancellationToken);

            Console.WriteLine($"[FLUSH SERVICE] ✓ Successfully flushed {toFlush.Count} impressions to database");
            _logger.LogInformation($"[FLUSH SERVICE] ✓ Successfully flushed {toFlush.Count} impressions to database");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[FLUSH SERVICE] ERROR: {ex.Message}");
            _logger.LogError(ex, "[FLUSH SERVICE] Failed to flush impressions");
        }
    }
}
