using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace CCMS.Api.Extensions;

/// <summary>
/// Rate limiting configuration for different types of API consumers.
/// Implements tiered rate limits based on security plan.
/// </summary>
public static class RateLimitingExtensions
{
    public const string PlayerPolicy = "player";
    public const string AuthPolicy = "auth";
    public const string ApiPolicy = "api";
    public const string StreamingPolicy = "streaming";

    public static IServiceCollection AddRateLimitingPolicies(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            // Global rejection behavior
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, cancellationToken) =>
            {
                context.HttpContext.Response.ContentType = "application/json";
                await context.HttpContext.Response.WriteAsync(
                    """{"success":false,"message":"Rate limit exceeded. Please try again later.","errors":["Too many requests"]}""",
                    cancellationToken);
            };

            // Player API rate limit - moderate limits for polling
            // Expected: 1 handshake + 1 playlist per minute per screen
            options.AddFixedWindowLimiter(PlayerPolicy, opt =>
            {
                opt.PermitLimit = 30;           // 30 requests
                opt.Window = TimeSpan.FromMinutes(1);
                opt.QueueLimit = 5;
                opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
            });

            // Authentication rate limit - strict to prevent brute force
            // Max 10 login attempts per 5 minutes per IP
            options.AddSlidingWindowLimiter(AuthPolicy, opt =>
            {
                opt.PermitLimit = 10;
                opt.Window = TimeSpan.FromMinutes(5);
                opt.SegmentsPerWindow = 5;
                opt.QueueLimit = 0;  // No queuing for auth
                opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
            });

            // General API rate limit - for dashboard users
            // 100 requests per minute per user
            options.AddTokenBucketLimiter(ApiPolicy, opt =>
            {
                opt.TokenLimit = 100;
                opt.TokensPerPeriod = 100;
                opt.ReplenishmentPeriod = TimeSpan.FromMinutes(1);
                opt.QueueLimit = 10;
                opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
            });

            // Streaming endpoints - higher limits for real-time operations
            // 200 requests per minute per screen for heartbeats/impressions
            options.AddFixedWindowLimiter(StreamingPolicy, opt =>
            {
                opt.PermitLimit = 200;
                opt.Window = TimeSpan.FromMinutes(1);
                opt.QueueLimit = 20;
                opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
            });

            // Global fallback policy
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
            {
                // Use IP address as partition key
                var remoteIp = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                
                return RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: remoteIp,
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 1000,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 50
                    });
            });
        });

        return services;
    }

    /// <summary>
    /// Creates a partitioned rate limiter based on client identifier (IP or user ID)
    /// </summary>
    public static RateLimitPartition<string> GetPartitionByClient(HttpContext context, int permitLimit, TimeSpan window)
    {
        // Try to get user ID from claims, otherwise use IP
        var userId = context.User?.Claims
            .FirstOrDefault(c => c.Type.Contains("nameidentifier"))?.Value;
        
        var partitionKey = userId ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: partitionKey,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = window
            });
    }
}
