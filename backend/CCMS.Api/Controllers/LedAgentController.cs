using Asp.Versioning;
using CCMS.Domain.Entities;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CCMS.Api.Controllers;

// ── Request / Response DTOs ──────────────────────────────────────────────

public class LedZoneDto
{
    public Guid Id { get; set; }
    public Guid ScreenId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public int ContentType { get; set; }
    public string? ContentConfig { get; set; }
    public bool IsActive { get; set; }
    public int DisplayOrder { get; set; }
}

public class UpsertLedZoneRequest
{
    public string Name { get; set; } = string.Empty;
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public int ContentType { get; set; }
    public string? ContentConfig { get; set; }
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }
}

public class LedAgentHeartbeatRequest
{
    public string AgentVersion { get; set; } = string.Empty;
    public string ControllerSoftware { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public decimal? TemperatureCelsius { get; set; }
}

public class LedAgentHeartbeatResponse
{
    public List<LedZoneDto> Zones { get; set; } = new();
    public string? PlayCommand { get; set; } // JSON play command from pending RemoteCommand
}

// ── Controller ───────────────────────────────────────────────────────────

[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/led")]
[Authorize]
public class LedAgentController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public LedAgentController(ApplicationDbContext context)
    {
        _context = context;
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        return Guid.Parse(claim!);
    }

    // ── Zone management (screen owner) ──────────────────────────────────

    [HttpGet("screens/{screenId}/zones")]
    public async Task<ActionResult<ApiResponse<List<LedZoneDto>>>> GetZones(Guid screenId, CancellationToken ct)
    {
        var userId = GetUserId();
        var screen = await _context.Screens.FirstOrDefaultAsync(s => s.Id == screenId && s.OwnerId == userId, ct);
        if (screen == null) return NotFound(ApiResponse<List<LedZoneDto>>.ErrorResponse("Screen not found"));

        var zones = await _context.LedWallZones
            .AsNoTracking()
            .Where(z => z.ScreenId == screenId)
            .OrderBy(z => z.DisplayOrder)
            .Select(z => new LedZoneDto
            {
                Id = z.Id,
                ScreenId = z.ScreenId,
                Name = z.Name,
                X = z.X, Y = z.Y, Width = z.Width, Height = z.Height,
                ContentType = (int)z.ContentType,
                ContentConfig = z.ContentConfig,
                IsActive = z.IsActive,
                DisplayOrder = z.DisplayOrder,
            })
            .ToListAsync(ct);

        return Ok(ApiResponse<List<LedZoneDto>>.SuccessResponse(zones));
    }

    [HttpPost("screens/{screenId}/zones")]
    public async Task<ActionResult<ApiResponse<LedZoneDto>>> CreateZone(Guid screenId, UpsertLedZoneRequest req, CancellationToken ct)
    {
        var userId = GetUserId();
        var screen = await _context.Screens.FirstOrDefaultAsync(s => s.Id == screenId && s.OwnerId == userId, ct);
        if (screen == null) return NotFound(ApiResponse<LedZoneDto>.ErrorResponse("Screen not found"));

        var zone = new LedWallZone
        {
            Id = Guid.NewGuid(),
            ScreenId = screenId,
            Name = req.Name,
            X = req.X, Y = req.Y, Width = req.Width, Height = req.Height,
            ContentType = (LedZoneContentType)req.ContentType,
            ContentConfig = req.ContentConfig,
            IsActive = req.IsActive,
            DisplayOrder = req.DisplayOrder,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        _context.LedWallZones.Add(zone);
        await _context.SaveChangesAsync(ct);

        return Created("", ApiResponse<LedZoneDto>.SuccessResponse(new LedZoneDto
        {
            Id = zone.Id, ScreenId = zone.ScreenId, Name = zone.Name,
            X = zone.X, Y = zone.Y, Width = zone.Width, Height = zone.Height,
            ContentType = (int)zone.ContentType, ContentConfig = zone.ContentConfig,
            IsActive = zone.IsActive, DisplayOrder = zone.DisplayOrder,
        }));
    }

    [HttpPut("screens/{screenId}/zones/{zoneId}")]
    public async Task<ActionResult<ApiResponse<LedZoneDto>>> UpdateZone(Guid screenId, Guid zoneId, UpsertLedZoneRequest req, CancellationToken ct)
    {
        var userId = GetUserId();
        var screen = await _context.Screens.FirstOrDefaultAsync(s => s.Id == screenId && s.OwnerId == userId, ct);
        if (screen == null) return NotFound(ApiResponse<LedZoneDto>.ErrorResponse("Screen not found"));

        var zone = await _context.LedWallZones.FirstOrDefaultAsync(z => z.Id == zoneId && z.ScreenId == screenId, ct);
        if (zone == null) return NotFound(ApiResponse<LedZoneDto>.ErrorResponse("Zone not found"));

        zone.Name = req.Name;
        zone.X = req.X; zone.Y = req.Y; zone.Width = req.Width; zone.Height = req.Height;
        zone.ContentType = (LedZoneContentType)req.ContentType;
        zone.ContentConfig = req.ContentConfig;
        zone.IsActive = req.IsActive;
        zone.DisplayOrder = req.DisplayOrder;

        await _context.SaveChangesAsync(ct);
        return Ok(ApiResponse<LedZoneDto>.SuccessResponse(new LedZoneDto
        {
            Id = zone.Id, ScreenId = zone.ScreenId, Name = zone.Name,
            X = zone.X, Y = zone.Y, Width = zone.Width, Height = zone.Height,
            ContentType = (int)zone.ContentType, ContentConfig = zone.ContentConfig,
            IsActive = zone.IsActive, DisplayOrder = zone.DisplayOrder,
        }));
    }

    [HttpDelete("screens/{screenId}/zones/{zoneId}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteZone(Guid screenId, Guid zoneId, CancellationToken ct)
    {
        var userId = GetUserId();
        var screen = await _context.Screens.FirstOrDefaultAsync(s => s.Id == screenId && s.OwnerId == userId, ct);
        if (screen == null) return NotFound(ApiResponse<bool>.ErrorResponse("Screen not found"));

        var zone = await _context.LedWallZones.FirstOrDefaultAsync(z => z.Id == zoneId && z.ScreenId == screenId, ct);
        if (zone == null) return NotFound(ApiResponse<bool>.ErrorResponse("Zone not found"));

        zone.IsDeleted = true;
        await _context.SaveChangesAsync(ct);
        return Ok(ApiResponse<bool>.SuccessResponse(true));
    }

    // ── LED Agent heartbeat (called by Windows LED Agent service) ────────

    /// <summary>
    /// LED Agent sends heartbeat with status; receives zone layout + any pending play commands.
    /// Auth: the agent authenticates using the paired device token in Authorization Bearer.
    /// </summary>
    [HttpPost("agent/heartbeat")]
    [AllowAnonymous] // Agent uses custom token-based auth via DeviceToken
    public async Task<ActionResult<ApiResponse<LedAgentHeartbeatResponse>>> AgentHeartbeat(
        [FromBody] LedAgentHeartbeatRequest req,
        [FromHeader(Name = "X-Device-Token")] string? deviceToken,
        CancellationToken ct)
    {
        if (string.IsNullOrEmpty(deviceToken))
            return Unauthorized(ApiResponse<LedAgentHeartbeatResponse>.ErrorResponse("X-Device-Token header required"));

        var agent = await _context.LedControllerAgents
            .FirstOrDefaultAsync(a => a.DeviceToken == deviceToken, ct);
        if (agent == null)
            return Unauthorized(ApiResponse<LedAgentHeartbeatResponse>.ErrorResponse("Invalid device token"));

        agent.LastSeenAt = DateTime.UtcNow;
        agent.IsOnline = true;
        agent.AgentVersion = req.AgentVersion;
        agent.ControllerSoftware = req.ControllerSoftware;
        agent.IpAddress = req.IpAddress;
        if (req.TemperatureCelsius.HasValue)
            agent.TemperatureCelsius = req.TemperatureCelsius;

        var zones = await _context.LedWallZones
            .AsNoTracking()
            .Where(z => z.ScreenId == agent.ScreenId && z.IsActive)
            .OrderBy(z => z.DisplayOrder)
            .Select(z => new LedZoneDto
            {
                Id = z.Id, ScreenId = z.ScreenId, Name = z.Name,
                X = z.X, Y = z.Y, Width = z.Width, Height = z.Height,
                ContentType = (int)z.ContentType, ContentConfig = z.ContentConfig,
                IsActive = z.IsActive, DisplayOrder = z.DisplayOrder,
            })
            .ToListAsync(ct);

        await _context.SaveChangesAsync(ct);

        return Ok(ApiResponse<LedAgentHeartbeatResponse>.SuccessResponse(new LedAgentHeartbeatResponse
        {
            Zones = zones,
        }));
    }
}
