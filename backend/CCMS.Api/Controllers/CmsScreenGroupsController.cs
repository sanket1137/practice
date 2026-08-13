using System.Security.Claims;
using Asp.Versioning;
using CCMS.Domain.Entities;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CCMS.Api.Controllers;

public class ScreenGroupDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<Guid> ScreenIds { get; set; } = new();
    public int MemberCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateScreenGroupRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<Guid> ScreenIds { get; set; } = new();
}

public class UpdateScreenGroupRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
}

// ── Phase 5: Mosaic DTOs ─────────────────────────────────────────────────

public class MosaicAssignmentDto
{
    public Guid Id { get; set; }
    public Guid ScreenId { get; set; }
    public int Row { get; set; }
    public int Col { get; set; }
    public int CropX { get; set; }
    public int CropY { get; set; }
    public int CropW { get; set; }
    public int CropH { get; set; }
    public string? SegmentR2Key { get; set; }
}

public class MosaicConfigDto
{
    public Guid GroupId { get; set; }
    public int Rows { get; set; } = 1;
    public int Cols { get; set; } = 1;
    public decimal BezelHorizontalMm { get; set; }
    public decimal BezelVerticalMm { get; set; }
    public int ContentMode { get; set; }
    public string? MasterVideoR2Key { get; set; }
    public List<MosaicAssignmentDto> Assignments { get; set; } = new();
}

public class SaveMosaicConfigRequest
{
    public int Rows { get; set; } = 1;
    public int Cols { get; set; } = 1;
    public decimal BezelHorizontalMm { get; set; }
    public decimal BezelVerticalMm { get; set; }
    public int ContentMode { get; set; }
    public List<MosaicAssignmentDto> Assignments { get; set; } = new();
}

[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/cms/screen-groups")]
[Authorize]
public class CmsScreenGroupsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public CmsScreenGroupsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ScreenGroupDto>>>> List(CancellationToken ct)
    {
        var userId = GetUserId();

        var groups = await _context.ScreenGroups
            .AsNoTracking()
            .Where(g => g.OwnerId == userId)
            .Select(g => new ScreenGroupDto
            {
                Id = g.Id,
                Name = g.Name,
                Description = g.Description,
                ScreenIds = g.Members.Select(m => m.ScreenId).ToList(),
                MemberCount = g.Members.Count(),
                CreatedAt = g.CreatedAt,
            })
            .ToListAsync(ct);

        return Ok(ApiResponse<List<ScreenGroupDto>>.SuccessResponse(groups));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<ScreenGroupDto>>> Get(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();

        var group = await _context.ScreenGroups
            .AsNoTracking()
            .Where(g => g.Id == id && g.OwnerId == userId)
            .Select(g => new ScreenGroupDto
            {
                Id = g.Id,
                Name = g.Name,
                Description = g.Description,
                ScreenIds = g.Members.Select(m => m.ScreenId).ToList(),
                MemberCount = g.Members.Count(),
                CreatedAt = g.CreatedAt,
            })
            .FirstOrDefaultAsync(ct);

        if (group == null)
            return NotFound(ApiResponse<ScreenGroupDto>.ErrorResponse("Group not found"));

        return Ok(ApiResponse<ScreenGroupDto>.SuccessResponse(group));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<ScreenGroupDto>>> Create(
        [FromBody] CreateScreenGroupRequest request, CancellationToken ct)
    {
        var userId = GetUserId();

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(ApiResponse<ScreenGroupDto>.ErrorResponse("Name is required"));

        var group = new ScreenGroup
        {
            OwnerId = userId,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
        };

        _context.ScreenGroups.Add(group);

        // Validate and add members (only screens owned by this user)
        if (request.ScreenIds.Any())
        {
            var validScreenIds = await _context.Screens
                .AsNoTracking()
                .Where(s => request.ScreenIds.Contains(s.Id) && s.OwnerId == userId && !s.IsDeleted)
                .Select(s => s.Id)
                .ToListAsync(ct);

            foreach (var sid in validScreenIds)
            {
                _context.ScreenGroupMembers.Add(new ScreenGroupMember { ScreenGroupId = group.Id, ScreenId = sid });
            }
        }

        await _context.SaveChangesAsync(ct);

        var dto = new ScreenGroupDto
        {
            Id = group.Id,
            Name = group.Name,
            Description = group.Description,
            ScreenIds = request.ScreenIds,
            MemberCount = request.ScreenIds.Count,
            CreatedAt = group.CreatedAt,
        };

        return Created(string.Empty, ApiResponse<ScreenGroupDto>.SuccessResponse(dto, "Group created"));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<ScreenGroupDto>>> Update(
        Guid id, [FromBody] UpdateScreenGroupRequest request, CancellationToken ct)
    {
        var userId = GetUserId();

        var group = await _context.ScreenGroups
            .FirstOrDefaultAsync(g => g.Id == id && g.OwnerId == userId, ct);

        if (group == null)
            return NotFound(ApiResponse<ScreenGroupDto>.ErrorResponse("Group not found"));

        if (request.Name != null) group.Name = request.Name.Trim();
        if (request.Description != null) group.Description = request.Description.Trim();
        group.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        var members = await _context.ScreenGroupMembers
            .AsNoTracking()
            .Where(m => m.ScreenGroupId == id)
            .Select(m => m.ScreenId)
            .ToListAsync(ct);

        return Ok(ApiResponse<ScreenGroupDto>.SuccessResponse(new ScreenGroupDto
        {
            Id = group.Id,
            Name = group.Name,
            Description = group.Description,
            ScreenIds = members,
            MemberCount = members.Count,
            CreatedAt = group.CreatedAt,
        }, "Group updated"));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();

        var group = await _context.ScreenGroups
            .FirstOrDefaultAsync(g => g.Id == id && g.OwnerId == userId, ct);

        if (group == null)
            return NotFound(ApiResponse<bool>.ErrorResponse("Group not found"));

        group.IsDeleted = true;
        group.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        return Ok(ApiResponse<bool>.SuccessResponse(true, "Group deleted"));
    }

    [HttpPost("{id}/screens/{screenId}")]
    public async Task<ActionResult<ApiResponse<bool>>> AddScreen(
        Guid id, Guid screenId, CancellationToken ct)
    {
        var userId = GetUserId();

        var groupExists = await _context.ScreenGroups.AnyAsync(g => g.Id == id && g.OwnerId == userId, ct);
        if (!groupExists)
            return NotFound(ApiResponse<bool>.ErrorResponse("Group not found"));

        var screenOwned = await _context.Screens.AnyAsync(s => s.Id == screenId && s.OwnerId == userId && !s.IsDeleted, ct);
        if (!screenOwned)
            return NotFound(ApiResponse<bool>.ErrorResponse("Screen not found"));

        var exists = await _context.ScreenGroupMembers
            .AnyAsync(m => m.ScreenGroupId == id && m.ScreenId == screenId, ct);
        if (exists)
            return Ok(ApiResponse<bool>.SuccessResponse(true, "Already a member"));

        _context.ScreenGroupMembers.Add(new ScreenGroupMember { ScreenGroupId = id, ScreenId = screenId });
        await _context.SaveChangesAsync(ct);

        return Ok(ApiResponse<bool>.SuccessResponse(true, "Screen added to group"));
    }

    [HttpDelete("{id}/screens/{screenId}")]
    public async Task<ActionResult<ApiResponse<bool>>> RemoveScreen(
        Guid id, Guid screenId, CancellationToken ct)
    {
        var userId = GetUserId();

        var groupExists = await _context.ScreenGroups.AnyAsync(g => g.Id == id && g.OwnerId == userId, ct);
        if (!groupExists)
            return NotFound(ApiResponse<bool>.ErrorResponse("Group not found"));

        var member = await _context.ScreenGroupMembers
            .FirstOrDefaultAsync(m => m.ScreenGroupId == id && m.ScreenId == screenId, ct);

        if (member == null)
            return NotFound(ApiResponse<bool>.ErrorResponse("Screen not in group"));

        _context.ScreenGroupMembers.Remove(member);
        await _context.SaveChangesAsync(ct);

        return Ok(ApiResponse<bool>.SuccessResponse(true, "Screen removed from group"));
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(claim, out var id))
            throw new UnauthorizedAccessException("Invalid user claim");
        return id;
    }

    // ── Phase 5: Mosaic Editor endpoints ─────────────────────────────────

    /// <summary>
    /// Get mosaic config for a group (Phase 5).
    /// GET /api/v1/cms/screen-groups/{id}/mosaic
    /// </summary>
    [HttpGet("{id}/mosaic")]
    public async Task<ActionResult<ApiResponse<MosaicConfigDto>>> GetMosaic(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();
        var group = await _context.ScreenGroups
            .AsNoTracking()
            .Include(g => g.ScreenAssignments)
            .FirstOrDefaultAsync(g => g.Id == id && g.OwnerId == userId, ct);
        if (group == null) return NotFound(ApiResponse<MosaicConfigDto>.ErrorResponse("Group not found"));

        return Ok(ApiResponse<MosaicConfigDto>.SuccessResponse(new MosaicConfigDto
        {
            GroupId = group.Id,
            Rows = group.Rows,
            Cols = group.Cols,
            BezelHorizontalMm = group.BezelHorizontalMm,
            BezelVerticalMm = group.BezelVerticalMm,
            ContentMode = (int)group.ContentMode,
            MasterVideoR2Key = group.MasterVideoR2Key,
            Assignments = group.ScreenAssignments.Select(a => new MosaicAssignmentDto
            {
                Id = a.Id,
                ScreenId = a.ScreenId,
                Row = a.Row,
                Col = a.Col,
                CropX = a.CropX, CropY = a.CropY, CropW = a.CropW, CropH = a.CropH,
                SegmentR2Key = a.SegmentR2Key,
            }).ToList(),
        }));
    }

    /// <summary>
    /// Save/update mosaic grid config for a group.
    /// PUT /api/v1/cms/screen-groups/{id}/mosaic
    /// </summary>
    [HttpPut("{id}/mosaic")]
    public async Task<ActionResult<ApiResponse<MosaicConfigDto>>> SaveMosaic(
        Guid id, [FromBody] SaveMosaicConfigRequest req, CancellationToken ct)
    {
        var userId = GetUserId();
        var group = await _context.ScreenGroups
            .Include(g => g.ScreenAssignments)
            .FirstOrDefaultAsync(g => g.Id == id && g.OwnerId == userId, ct);
        if (group == null) return NotFound(ApiResponse<MosaicConfigDto>.ErrorResponse("Group not found"));

        group.Rows = req.Rows;
        group.Cols = req.Cols;
        group.BezelHorizontalMm = req.BezelHorizontalMm;
        group.BezelVerticalMm = req.BezelVerticalMm;
        group.ContentMode = (CCMS.Domain.Entities.ScreenGroupContentMode)req.ContentMode;

        // Replace assignments
        foreach (var a in group.ScreenAssignments.ToList())
            a.IsDeleted = true;

        foreach (var a in req.Assignments)
        {
            _context.ScreenGroupAssignments.Add(new CCMS.Domain.Entities.ScreenGroupAssignment
            {
                Id = Guid.NewGuid(),
                GroupId = group.Id,
                ScreenId = a.ScreenId,
                Row = a.Row,
                Col = a.Col,
                CropX = a.CropX, CropY = a.CropY, CropW = a.CropW, CropH = a.CropH,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
        }

        await _context.SaveChangesAsync(ct);
        return Ok(ApiResponse<MosaicConfigDto>.SuccessResponse(new MosaicConfigDto
        {
            GroupId = group.Id,
            Rows = group.Rows,
            Cols = group.Cols,
            BezelHorizontalMm = group.BezelHorizontalMm,
            BezelVerticalMm = group.BezelVerticalMm,
            ContentMode = (int)group.ContentMode,
            Assignments = req.Assignments,
        }));
    }
}