using CCMS.Api.Hubs;
using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace CCMS.Api.Services;

/// <summary>
/// Owner/admin-triggerable lifecycle actions. Verification passing/failing is a
/// system transition (OnVerificationPassed/OnVerificationRejected), not an action.
/// </summary>
public enum ScreenLifecycleAction
{
    SubmitForVerification,
    Activate,
    Pause,
    Resume,
    StartMaintenance,
    EndMaintenance,
    Archive,
}

public class ScreenLifecycleResult
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public ScreenStatus Status { get; set; }
    public List<string> AllowedActions { get; set; } = new();
}

/// <summary>
/// The ONLY code path allowed to change Screen.Status after creation.
///
/// Three orthogonal axes, never conflated:
///  - Lifecycle (this service): Draft → PendingVerification → Ready → Active
///    ⇄ Paused/Maintenance → Archived. Owner intent gated by platform trust.
///  - Verification (ScreenVerificationService): a guard on lifecycle
///    transitions, not a lifecycle state itself.
///  - Connectivity (ScreenStatusMonitor → Screen.IsOnline): telemetry derived
///    from heartbeats. A screen can be Active-and-offline (that's an alert)
///    or Ready-and-online (that's a screen waiting to open for business).
///
/// Every transition writes a ScreenLifecycleEvent audit row and broadcasts
/// ScreenLifecycleChanged { screenId, status } — the shape the dashboard
/// already listens for.
/// </summary>
public class ScreenLifecycleService
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<ScreenLifecycleEvent> _eventRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IHubContext<PlaybackHub> _hubContext;
    private readonly INotificationService _notificationService;
    private readonly ILogger<ScreenLifecycleService> _logger;

    public ScreenLifecycleService(
        IRepository<Screen> screenRepository,
        IRepository<Booking> bookingRepository,
        IRepository<ScreenLifecycleEvent> eventRepository,
        IUnitOfWork unitOfWork,
        IHubContext<PlaybackHub> hubContext,
        INotificationService notificationService,
        ILogger<ScreenLifecycleService> logger)
    {
        _screenRepository = screenRepository;
        _bookingRepository = bookingRepository;
        _eventRepository = eventRepository;
        _unitOfWork = unitOfWork;
        _hubContext = hubContext;
        _notificationService = notificationService;
        _logger = logger;
    }

    /// <summary>
    /// Actions the given screen's owner may take from its current state.
    /// The UI renders lifecycle buttons from this list — it never computes
    /// its own transition rules.
    /// </summary>
    public static List<ScreenLifecycleAction> AllowedActions(Screen screen)
    {
        return screen.Status switch
        {
            ScreenStatus.Draft => new() { ScreenLifecycleAction.SubmitForVerification },
            ScreenStatus.PendingVerification => new(), // waiting on the verification flow
            ScreenStatus.Ready => new() { ScreenLifecycleAction.Activate, ScreenLifecycleAction.Archive },
            ScreenStatus.Active => new() { ScreenLifecycleAction.Pause, ScreenLifecycleAction.StartMaintenance, ScreenLifecycleAction.Archive },
            ScreenStatus.Paused => new() { ScreenLifecycleAction.Resume, ScreenLifecycleAction.Archive },
            ScreenStatus.Maintenance => new() { ScreenLifecycleAction.EndMaintenance, ScreenLifecycleAction.Archive },
            ScreenStatus.Archived => new(),
            // Legacy values that predate the migration — surface the single
            // action that moves them onto the real lifecycle.
            ScreenStatus.Inactive => new() { ScreenLifecycleAction.Resume, ScreenLifecycleAction.Archive },
            ScreenStatus.Offline => new() { ScreenLifecycleAction.Activate, ScreenLifecycleAction.Archive },
            _ => new(),
        };
    }

    public async Task<ScreenLifecycleResult> TransitionAsync(
        Guid screenId,
        ScreenLifecycleAction action,
        Guid actorUserId,
        bool isAdmin,
        string? reason,
        CancellationToken cancellationToken = default)
    {
        var screen = await _screenRepository.GetByIdAsync(screenId, cancellationToken);
        if (screen == null)
            return Fail(default, "Screen not found");

        if (!isAdmin && screen.OwnerId != actorUserId)
            return Fail(screen.Status, "You can only manage your own screens");

        if (!AllowedActions(screen).Contains(action))
            return Fail(screen.Status, $"'{action}' is not available while the screen is {screen.Status}");

        var guardError = await CheckGuardsAsync(screen, action, cancellationToken);
        if (guardError != null)
            return Fail(screen.Status, guardError);

        var target = TargetOf(action, screen);
        await ApplyAsync(screen, target, actorUserId, isAdmin ? "Admin" : "Owner", reason, cancellationToken);

        // Owner-facing moments worth a notification, not just a log line.
        if (target == ScreenStatus.Active)
        {
            await SafeNotifyAsync(screen.OwnerId, "Screen is live",
                $"'{screen.Name}' is now open for booking and visible to advertisers.",
                NotificationType.SystemAlert, $"/screens/{screen.Id}");
        }

        return new ScreenLifecycleResult
        {
            Success = true,
            Status = screen.Status,
            AllowedActions = AllowedActions(screen).Select(a => a.ToString()).ToList(),
        };
    }

    /// <summary>System transition: QR verification approved.</summary>
    public async Task OnVerificationPassedAsync(Screen screen, CancellationToken cancellationToken = default)
    {
        // Verified screens that were mid-flow move to Ready; screens verified
        // through re-verification while already operating keep their state.
        if (screen.Status is not (ScreenStatus.PendingVerification or ScreenStatus.Draft))
            return;

        await ApplyAsync(screen, ScreenStatus.Ready, null, "System", "QR verification approved", cancellationToken);
        await SafeNotifyAsync(screen.OwnerId, "You're ready to earn",
            $"'{screen.Name}' passed verification. Activate it to open for booking.",
            NotificationType.SystemAlert, $"/screens/{screen.Id}");
    }

    /// <summary>System transition: QR verification rejected — back to Draft with the reason.</summary>
    public async Task OnVerificationRejectedAsync(Screen screen, string reason, CancellationToken cancellationToken = default)
    {
        if (screen.Status != ScreenStatus.PendingVerification)
            return;

        await ApplyAsync(screen, ScreenStatus.Draft, null, "System", $"Verification rejected: {reason}", cancellationToken);
    }

    private static ScreenStatus TargetOf(ScreenLifecycleAction action, Screen screen) => action switch
    {
        ScreenLifecycleAction.SubmitForVerification => ScreenStatus.PendingVerification,
        ScreenLifecycleAction.Activate => ScreenStatus.Active,
        ScreenLifecycleAction.Pause => ScreenStatus.Paused,
        ScreenLifecycleAction.Resume => ScreenStatus.Active,
        ScreenLifecycleAction.StartMaintenance => ScreenStatus.Maintenance,
        ScreenLifecycleAction.EndMaintenance => ScreenStatus.Active,
        ScreenLifecycleAction.Archive => ScreenStatus.Archived,
        _ => screen.Status,
    };

    private async Task<string?> CheckGuardsAsync(Screen screen, ScreenLifecycleAction action, CancellationToken ct)
    {
        switch (action)
        {
            case ScreenLifecycleAction.SubmitForVerification:
                if (string.IsNullOrWhiteSpace(screen.Name)) return "Give the screen a name before submitting.";
                if (string.IsNullOrWhiteSpace(screen.Location.City)) return "Set the screen's location before submitting.";
                if (screen.PricePerSlot <= 0) return "Set a price per slot before submitting.";
                if (screen.ResolutionWidth <= 0 || screen.ResolutionHeight <= 0) return "Set the screen resolution before submitting.";
                return null;

            case ScreenLifecycleAction.Activate:
            case ScreenLifecycleAction.Resume:
            case ScreenLifecycleAction.EndMaintenance:
                if (screen.VerificationStatus != ScreenVerificationStatus.Verified)
                    return "The screen must pass verification before it can go live.";
                // Activation additionally requires that a player has paired at
                // least once — an Active screen with no device would sell slots
                // nothing will ever play.
                if (action == ScreenLifecycleAction.Activate &&
                    string.IsNullOrEmpty(screen.ApiKeyHash))
                    return "Generate an API key and pair the player device before activating.";
                if (action == ScreenLifecycleAction.Activate &&
                    screen.LastSeenAt == null && string.IsNullOrEmpty(screen.ConnectedDeviceId))
                    return "The player device hasn't connected yet. Pair it (it only needs to check in once) and try again.";
                return null;

            case ScreenLifecycleAction.Archive:
            {
                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                var blocking = await _bookingRepository.FindAsync(b =>
                    b.ScreenId == screen.Id && !b.IsDeleted &&
                    (b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active) &&
                    b.EndDate >= today, ct);
                return blocking.Any()
                    ? "This screen still has approved or active bookings. Wait for them to finish or cancel them first."
                    : null;
            }

            default:
                return null;
        }
    }

    private async Task ApplyAsync(Screen screen, ScreenStatus target, Guid? actorUserId, string actorRole, string? reason, CancellationToken ct)
    {
        var from = screen.Status;
        screen.Status = target;
        screen.UpdatedAt = DateTime.UtcNow;
        await _screenRepository.UpdateAsync(screen, ct);

        await _eventRepository.AddAsync(new ScreenLifecycleEvent
        {
            ScreenId = screen.Id,
            FromStatus = from,
            ToStatus = target,
            ActorUserId = actorUserId,
            ActorRole = actorRole,
            Reason = reason,
        }, ct);

        await _unitOfWork.SaveChangesAsync(ct);

        _logger.LogInformation("Screen {ScreenId} lifecycle: {From} -> {To} by {Role} ({Reason})",
            screen.Id, from, target, actorRole, reason ?? "no reason given");

        // Same event name and payload shape the dashboard already handles.
        await _hubContext.Clients.All.SendAsync("ScreenLifecycleChanged", new
        {
            screenId = screen.Id.ToString(),
            status = target.ToString(),
        }, ct);
    }

    private async Task SafeNotifyAsync(Guid userId, string title, string message, NotificationType type, string actionUrl)
    {
        try
        {
            await _notificationService.CreateNotificationAsync(userId, title, message, type, actionUrl);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Lifecycle notification failed (transition already committed)");
        }
    }

    private static ScreenLifecycleResult Fail(ScreenStatus status, string error) => new()
    {
        Success = false,
        Error = error,
        Status = status,
    };
}
