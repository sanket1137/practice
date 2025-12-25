using Microsoft.AspNetCore.Mvc;
using CCMS.Api.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace CCMS.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StreamingController : ControllerBase
{
    private readonly IHubContext<StreamingHub> _hubContext;
    private readonly ILogger<StreamingController> _logger;

    public StreamingController(
        IHubContext<StreamingHub> hubContext,
        ILogger<StreamingController> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    [HttpPost("register")]
    public IActionResult RegisterStream([FromBody] RegisterStreamRequest request)
    {
        try
        {
            _logger.LogInformation(
                "HTTP: Registering stream for screen {ScreenId}",
                request.ScreenId);

            // Add to active streams (accessing static dictionary)
            var success = StreamingHub.RegisterStreamFromHttp(request.ScreenId, request.ConnectionId ?? "http-player");
            
            if (success)
            {
                _logger.LogInformation("Stream registered successfully for screen {ScreenId}", request.ScreenId);
                return Ok(new { success = true, message = "Stream registered successfully" });
            }
            else
            {
                _logger.LogWarning("Stream already registered for screen {ScreenId}", request.ScreenId);
                return Ok(new { success = true, message = "Stream already active" });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error registering stream for screen {ScreenId}", request.ScreenId);
            return StatusCode(500, new { success = false, message = ex.Message });
        }
    }

    [HttpPost("unregister")]
    public IActionResult UnregisterStream([FromBody] UnregisterStreamRequest request)
    {
        try
        {
            _logger.LogInformation("HTTP: Unregistering stream for screen {ScreenId}", request.ScreenId);
            
            StreamingHub.UnregisterStreamFromHttp(request.ScreenId);
            
            return Ok(new { success = true, message = "Stream unregistered" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unregistering stream");
            return StatusCode(500, new { success = false, message = ex.Message });
        }
    }
    
    [HttpGet("pending-viewers/{screenId}")]
    public IActionResult GetPendingViewers(string screenId)
    {
        try
        {
            var viewers = StreamingHub.GetPendingViewers(screenId);
            return Ok(new { viewers = viewers });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting pending viewers for screen {ScreenId}", screenId);
            return StatusCode(500, new { success = false, message = ex.Message });
        }
    }
}

public class RegisterStreamRequest
{
    public string ScreenId { get; set; } = string.Empty;
    public string? ConnectionId { get; set; }
    public string? ApiKey { get; set; }
}

public class UnregisterStreamRequest
{
    public string ScreenId { get; set; } = string.Empty;
}
