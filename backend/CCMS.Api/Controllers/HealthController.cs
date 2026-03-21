using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CCMS.Infrastructure.Data;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

/// <summary>
/// Health check endpoint for container orchestration and load balancers
/// </summary>
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
public class HealthController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<HealthController> _logger;

    public HealthController(ApplicationDbContext context, ILogger<HealthController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Basic health check - returns 200 if API is running
    /// </summary>
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new
        {
            status = "healthy",
            timestamp = DateTime.UtcNow,
            version = "1.0.0"
        });
    }

    /// <summary>
    /// Detailed health check including database connectivity
    /// </summary>
    [HttpGet("detailed")]
    public async Task<IActionResult> GetDetailed()
    {
        var health = new
        {
            status = "healthy",
            timestamp = DateTime.UtcNow,
            version = "1.0.0",
            checks = new Dictionary<string, object>()
        };

        try
        {
            // Check database connectivity
            var canConnect = await _context.Database.CanConnectAsync();
            health.checks["database"] = new
            {
                status = canConnect ? "healthy" : "unhealthy",
                message = canConnect ? "Connected" : "Cannot connect to database"
            };

            if (!canConnect)
            {
                return StatusCode(503, new
                {
                    status = "unhealthy",
                    timestamp = DateTime.UtcNow,
                    checks = health.checks
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Health check failed");
            health.checks["database"] = new
            {
                status = "unhealthy",
                message = ex.Message
            };

            return StatusCode(503, new
            {
                status = "unhealthy",
                timestamp = DateTime.UtcNow,
                checks = health.checks
            });
        }

        return Ok(health);
    }

    /// <summary>
    /// Liveness probe - just checks if the app is running
    /// </summary>
    [HttpGet("live")]
    public IActionResult Live()
    {
        return Ok("alive");
    }

    /// <summary>
    /// Readiness probe - checks if the app can handle requests
    /// </summary>
    [HttpGet("ready")]
    public async Task<IActionResult> Ready()
    {
        try
        {
            var canConnect = await _context.Database.CanConnectAsync();
            if (canConnect)
            {
                return Ok("ready");
            }
            return StatusCode(503, "not ready - database unavailable");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Readiness check failed");
            return StatusCode(503, $"not ready - {ex.Message}");
        }
    }
}
