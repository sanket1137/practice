using System.Text.Json;
using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using CCMS.Shared.DTOs.Cms;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CCMS.Infrastructure.Services;

public class RemoteCommandService : IRemoteCommandService
{
    // Subset of commands that only apply to CMS-mode screens. Dashboard UI
    // must hide these for DOOH screens; backend also gates here as defense-in-depth.
    private static readonly HashSet<RemoteCommandType> CmsOnlyCommands = new()
    {
        RemoteCommandType.Play,
        RemoteCommandType.Pause,
        RemoteCommandType.Skip,
        RemoteCommandType.RestartLoop,
        RemoteCommandType.JumpTo,
        RemoteCommandType.SetItemDuration
    };

    private readonly ApplicationDbContext _context;
    private readonly ILogger<RemoteCommandService> _logger;

    public RemoteCommandService(ApplicationDbContext context, ILogger<RemoteCommandService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<RemoteCommandDto> IssueAsync(Guid userId, IssueRemoteCommandRequest request, CancellationToken ct = default)
    {
        if (!Enum.TryParse<RemoteCommandType>(request.CommandType, true, out var commandType))
        {
            throw new ArgumentException($"Unknown command type: {request.CommandType}");
        }

        var screen = await _context.Screens
            .Include(s => s.Owner)
            .FirstOrDefaultAsync(s => s.Id == request.ScreenId && s.OwnerId == userId, ct)
            ?? throw new KeyNotFoundException("Screen not found");

        if (CmsOnlyCommands.Contains(commandType) && screen.Owner.AccountType != AccountType.CmsOwner)
        {
            throw new InvalidOperationException("This command is only valid for CMS-mode screens");
        }

        var payloadJson = request.Payload == null ? null : JsonSerializer.Serialize(request.Payload);

        var entity = new RemoteCommand
        {
            ScreenId = request.ScreenId,
            IssuedByUserId = userId,
            CommandType = commandType,
            PayloadJson = payloadJson,
            Status = RemoteCommandStatus.Pending,
            IssuedAt = DateTime.UtcNow
        };
        _context.RemoteCommands.Add(entity);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Remote command {Cmd} issued for screen {ScreenId} by user {UserId} (cmdId={Id})",
            commandType, request.ScreenId, userId, entity.Id);

        return ToDto(entity);
    }

    public async Task<List<RemoteCommandDto>> GetRecentAsync(Guid userId, Guid screenId, int limit = 50, CancellationToken ct = default)
    {
        var ownsScreen = await _context.Screens
            .AnyAsync(s => s.Id == screenId && s.OwnerId == userId, ct);
        if (!ownsScreen) throw new KeyNotFoundException("Screen not found");

        limit = Math.Clamp(limit, 1, 200);
        var rows = await _context.RemoteCommands
            .AsNoTracking()
            .Where(c => c.ScreenId == screenId)
            .OrderByDescending(c => c.IssuedAt)
            .Take(limit)
            .ToListAsync(ct);

        return rows.Select(ToDto).ToList();
    }

    public async Task AckAsync(Guid screenId, AckCommandRequest request, CancellationToken ct = default)
    {
        var command = await _context.RemoteCommands
            .FirstOrDefaultAsync(c => c.Id == request.CommandId && c.ScreenId == screenId, ct);
        if (command == null) return; // Silently ignore unknown ACKs

        command.Status = request.Success ? RemoteCommandStatus.Acked : RemoteCommandStatus.Failed;
        command.AckedAt = DateTime.UtcNow;
        command.ErrorMessage = request.ErrorMessage;
        await _context.SaveChangesAsync(ct);
    }

    private static RemoteCommandDto ToDto(RemoteCommand c) => new()
    {
        Id = c.Id,
        ScreenId = c.ScreenId,
        CommandType = c.CommandType.ToString(),
        PayloadJson = c.PayloadJson,
        Status = c.Status.ToString(),
        IssuedAt = c.IssuedAt,
        DispatchedAt = c.DispatchedAt,
        AckedAt = c.AckedAt,
        ErrorMessage = c.ErrorMessage
    };
}
