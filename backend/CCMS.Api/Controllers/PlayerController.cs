using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using CCMS.Api.Extensions;
using CCMS.Api.Hubs;
using CCMS.Api.Services;
using CCMS.Application.Interfaces;
using CCMS.Application.Services;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Player;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/player")]
[EnableRateLimiting(RateLimitingExtensions.PlayerPolicy)]
public class PlayerController : ControllerBase
{
    private readonly IRepository<Screen> _screenRepository;
    private readonly PlaylistGeneratorService _playlistService;
    private readonly IRepository<Impression> _impressionRepository;
    private readonly IRepository<OwnerContent> _ownerContentRepository;
    // PlaybackHub is the ONLY real-time channel: the dashboard and every player
    // platform connect to /hubs/playback. Broadcasts used to go to PlayerHub — a
    // legacy hub nothing connected to — so screen-online and impression events
    // never reached any dashboard.
    private readonly IHubContext<PlaybackHub> _hubContext;
    private readonly ILogger<PlayerController> _logger;
    private readonly ITimeZoneService _timeZoneService;
    private readonly PlayerDeviceManager _deviceManager;
    private readonly ICmsPlaylistService _cmsPlaylistService;
    private readonly ApplicationDbContext _dbContext;

    // Cache valid owner content IDs to avoid repeated DB lookups
    private HashSet<Guid>? _validOwnerContentIds;

    /// <summary>
    /// Verifies a player's API key on requests after handshake (sync/heartbeat).
    /// Mirrors Handshake's own (now strict) check — a screen with no key
    /// configured is rejected, and a stolen screenId alone is never sufficient
    /// to fake heartbeats or inject impressions for someone else's screen.
    /// </summary>
    private bool VerifyApiKey(Screen screen, string? providedApiKey)
    {
        if (string.IsNullOrEmpty(screen.ApiKeyHash))
        {
            return false;
        }

        return !string.IsNullOrEmpty(providedApiKey) && BCrypt.Net.BCrypt.Verify(providedApiKey, screen.ApiKeyHash);
    }

    private readonly CCMS.Api.Security.PlayerSessionStore _sessionStore;

    public PlayerController(
        IRepository<Screen> screenRepository,
        PlaylistGeneratorService playlistService,
        IRepository<Impression> impressionRepository,
        IRepository<OwnerContent> ownerContentRepository,
        IHubContext<PlaybackHub> hubContext,
        ILogger<PlayerController> logger,
        ITimeZoneService timeZoneService,
        PlayerDeviceManager deviceManager,
        ICmsPlaylistService cmsPlaylistService,
        ApplicationDbContext dbContext,
        CCMS.Api.Security.PlayerSessionStore sessionStore)
    {
        _screenRepository = screenRepository;
        _playlistService = playlistService;
        _impressionRepository = impressionRepository;
        _ownerContentRepository = ownerContentRepository;
        _hubContext = hubContext;
        _logger = logger;
        _timeZoneService = timeZoneService;
        _deviceManager = deviceManager;
        _cmsPlaylistService = cmsPlaylistService;
        _dbContext = dbContext;
        _sessionStore = sessionStore;
    }

    /// <summary>
    /// Player handshake - called once when player starts
    /// </summary>
    [HttpPost("handshake")]
    public async Task<ActionResult<ApiResponse<HandshakeResponse>>> Handshake([FromBody] HandshakeRequest request)
    {
        try
        {
            _logger.LogInformation($"Handshake request from screen: {request.ScreenId}");

            if (!Guid.TryParse(request.ScreenId, out var screenGuid))
            {
                return BadRequest(ApiResponse<HandshakeResponse>.ErrorResponse("Invalid screen ID"));
            }

            var screen = await _screenRepository.GetByIdAsync(screenGuid);
            if (screen == null)
            {
                _logger.LogWarning($"Handshake failed: Screen not found {request.ScreenId}");
                return NotFound(ApiResponse<HandshakeResponse>.ErrorResponse("Screen not found"));
            }

            // Verify API key using BCrypt. A screen with no key configured is
            // rejected rather than allowed through — knowing a screen's GUID
            // must never be sufficient on its own to pull its playlist/handshake.
            // If this ever legitimately fires for a real screen, generate an
            // API key for it from the dashboard rather than relaxing this check.
            if (string.IsNullOrEmpty(screen.ApiKeyHash))
            {
                _logger.LogWarning($"Handshake failed: screen {request.ScreenId} has no API key configured");
                return Unauthorized(ApiResponse<HandshakeResponse>.ErrorResponse(
                    "Screen has no API key configured. Generate one from the dashboard before pairing this player."));
            }

            if (string.IsNullOrEmpty(request.ApiKey) ||
                !BCrypt.Net.BCrypt.Verify(request.ApiKey, screen.ApiKeyHash))
            {
                _logger.LogWarning($"Handshake failed: Invalid API key for screen {request.ScreenId}");
                return Unauthorized(ApiResponse<HandshakeResponse>.ErrorResponse("Invalid API key"));
            }
            _logger.LogDebug($"API key verified for screen {request.ScreenId}");

            // Validate device fingerprint if provided
            string deviceBindingStatus = "not_provided";
            if (!string.IsNullOrEmpty(request.DeviceFingerprint))
            {
                var deviceResult = await _deviceManager.ValidateDeviceFingerprintAsync(
                    screenGuid, request.DeviceFingerprint);
                
                if (!deviceResult.IsValid)
                {
                    _logger.LogWarning(
                        $"Device fingerprint mismatch for screen {request.ScreenId}: {deviceResult.Reason}");
                    return Unauthorized(ApiResponse<HandshakeResponse>.ErrorResponse(
                        $"Device verification failed: {deviceResult.Reason}"));
                }
                
                deviceBindingStatus = deviceResult.IsNewBinding ? "new_binding" 
                    : deviceResult.IsOverride ? "override" 
                    : "bound";
            }

            // Update screen status
            screen.LastSeenAt = DateTime.UtcNow;
            screen.IsOnline = true;
            await _screenRepository.UpdateAsync(screen);

            // Broadcast status change. "ScreenStatusChanged" is the single canonical
            // event name for online/offline transitions; sent to All because
            // screens-list pages are not subscribed to per-screen groups.
            await _hubContext.Clients.All
                .SendAsync("ScreenStatusChanged", new
                {
                    screenId = request.ScreenId,
                    isOnline = true,
                    lastSeen = screen.LastSeenAt,
                    timestamp = DateTime.UtcNow
                });

            // Get today's playlist using configured timezone
            var currentDate = _timeZoneService.GetCurrentDate();
            _logger.LogInformation($"Generating playlist for {_timeZoneService.TimeZone.Id}: {currentDate:yyyy-MM-dd}");
            var playlist = await _playlistService.GeneratePlaylistAsync(screenGuid, currentDate);

            // Serialize operating schedule for the player
            var operatingHours = new Dictionary<string, string>();
            if (screen.Schedule != null)
            {
                try
                {
                    // Convert the Schedule object to a dictionary format for the player
                    var schedule = screen.Schedule;
                    operatingHours["Monday"] = schedule.Monday.IsOperating ? $"{schedule.Monday.StartTime:hh\\:mm}-{schedule.Monday.EndTime:hh\\:mm}" : "closed";
                    operatingHours["Tuesday"] = schedule.Tuesday.IsOperating ? $"{schedule.Tuesday.StartTime:hh\\:mm}-{schedule.Tuesday.EndTime:hh\\:mm}" : "closed";
                    operatingHours["Wednesday"] = schedule.Wednesday.IsOperating ? $"{schedule.Wednesday.StartTime:hh\\:mm}-{schedule.Wednesday.EndTime:hh\\:mm}" : "closed";
                    operatingHours["Thursday"] = schedule.Thursday.IsOperating ? $"{schedule.Thursday.StartTime:hh\\:mm}-{schedule.Thursday.EndTime:hh\\:mm}" : "closed";
                    operatingHours["Friday"] = schedule.Friday.IsOperating ? $"{schedule.Friday.StartTime:hh\\:mm}-{schedule.Friday.EndTime:hh\\:mm}" : "closed";
                    operatingHours["Saturday"] = schedule.Saturday.IsOperating ? $"{schedule.Saturday.StartTime:hh\\:mm}-{schedule.Saturday.EndTime:hh\\:mm}" : "closed";
                    operatingHours["Sunday"] = schedule.Sunday.IsOperating ? $"{schedule.Sunday.StartTime:hh\\:mm}-{schedule.Sunday.EndTime:hh\\:mm}" : "closed";
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to serialize operating schedule");
                }
            }
            
            // Generate verification salt for this session (or use a stored one)
            var verificationSalt = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(16));
            
            // Generate session token for secure communication
            var sessionToken = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
            var serverSalt = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(16));
            var sessionExpiresAt = DateTime.UtcNow.AddHours(24);

            // Registers this session so PlayerAuthFilter can verify signed
            // requests keyed by this token (see PlayerAuthenticationService.ValidateSignature).
            _sessionStore.StoreSession(request.ScreenId, new CCMS.Api.Security.PlayerSession
            {
                ScreenId = request.ScreenId,
                Token = sessionToken,
                Salt = serverSalt,
                ExpiresAt = sessionExpiresAt,
                DeviceFingerprint = request.DeviceFingerprint ?? string.Empty
            });

            _logger.LogInformation($"Handshake successful for screen {request.ScreenId} (device: {deviceBindingStatus})");

            // Check if screen requires QR verification
            var isVerified = screen.VerificationStatus == ScreenVerificationStatus.Verified;
            var verificationMode = !isVerified;

            // Look up owner account type to decide whether to attach the CMS playlist.
            var ownerAccountType = await _dbContext.Users
                .AsNoTracking()
                .Where(u => u.Id == screen.OwnerId)
                .Select(u => u.AccountType)
                .FirstOrDefaultAsync();

            var isCmsMode = ownerAccountType == AccountType.CmsOwner;
            CCMS.Shared.DTOs.Cms.CmsPlaylistDto? cmsPlaylistDto = null;
            List<CCMS.Shared.DTOs.Player.ScheduleWindowPlayerDto>? scheduleWindows = null;
            if (isCmsMode && !verificationMode)
            {
                try
                {
                    cmsPlaylistDto = await _cmsPlaylistService.GetDefaultForPlayerAsync(screenGuid);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to load CMS playlist for screen {ScreenId}", request.ScreenId);
                }

                try
                {
                    var windows = await _dbContext.ScheduleWindows
                        .AsNoTracking()
                        .Where(w => w.ScreenId == screenGuid && w.IsActive)
                        .Include(w => w.Playlist)
                            .ThenInclude(p => p.Items.OrderBy(i => i.Order))
                                .ThenInclude(i => i.MediaAsset)
                        .ToListAsync();

                    if (windows.Any())
                    {
                        scheduleWindows = windows.Select(w => new CCMS.Shared.DTOs.Player.ScheduleWindowPlayerDto
                        {
                            Id = w.Id,
                            DaysOfWeekMask = w.DaysOfWeekMask,
                            StartMinute = w.StartMinute,
                            EndMinute = w.EndMinute,
                            PlaylistId = w.PlaylistId,
                            Label = w.Label,
                            Items = w.Playlist?.Items?.OrderBy(i => i.Order).Select(i => new CCMS.Shared.DTOs.Cms.CmsPlaylistItemDto
                            {
                                Id = i.Id,
                                MediaAssetId = i.MediaAssetId,
                                ItemType = i.ItemType.ToString(),
                                Order = i.Order,
                                DurationSeconds = i.DurationSeconds,
                                MediaAsset = i.MediaAsset == null ? null : new CCMS.Shared.DTOs.Cms.MediaAssetDto
                                {
                                    Id = i.MediaAsset.Id,
                                    OriginalName = i.MediaAsset.OriginalName,
                                    MimeType = i.MediaAsset.MimeType,
                                    SizeBytes = i.MediaAsset.SizeBytes,
                                    FileUrl = i.MediaAsset.FileUrl,
                                    ThumbnailUrl = i.MediaAsset.ThumbnailUrl,
                                    Width = i.MediaAsset.Width,
                                    Height = i.MediaAsset.Height,
                                    DurationSeconds = i.MediaAsset.DurationSeconds,
                                    IsReady = i.MediaAsset.IsReady,
                                    CreatedAt = i.MediaAsset.CreatedAt
                                }
                            }).ToList() ?? new()
                        }).ToList();
                        _logger.LogInformation("Loaded {Count} schedule windows for screen {ScreenId}", scheduleWindows.Count, request.ScreenId);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to load schedule windows for screen {ScreenId}", request.ScreenId);
                }
            }

            var response = new HandshakeResponse
            {
                Success = true,
                ServerTime = DateTime.UtcNow,
                Playlist = verificationMode ? null : playlist,
                SyncIntervalMinutes = 10,
                Message = verificationMode ? "Screen requires verification" : "Handshake successful",
                ScreenTimezone = screen.Timezone,
                OperatingHours = operatingHours,
                VerificationSalt = verificationSalt,
                SessionToken = sessionToken,
                ServerSalt = serverSalt,
                SessionExpiresAt = sessionExpiresAt,
                DeviceBindingStatus = deviceBindingStatus,
                VerificationMode = verificationMode,
                VerificationStatus = screen.VerificationStatus.ToString(),
                CmsPlaylist = cmsPlaylistDto,
                ScheduleWindows = scheduleWindows,
                ScreenMode = isCmsMode ? "Cms" : "Dooh"
            };

            return Ok(ApiResponse<HandshakeResponse>.SuccessResponse(response));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Handshake error for screen {ScreenId}", request.ScreenId);
            return StatusCode(500, ApiResponse<HandshakeResponse>.ErrorResponse("Handshake failed."));
        }
    }

    /// <summary>
    /// Player sync - called every 10 minutes to send accumulated data
    /// Supports both legacy format (CampaignImpressions/OwnerContentImpressions) and 
    /// new flat Impressions array with UPSERT deduplication via SlotPlayKey
    /// </summary>
    [HttpPost("sync")]
    public async Task<ActionResult<ApiResponse<SyncResponse>>> Sync([FromBody] SyncRequest request)
    {
        try
        {
            _logger.LogInformation($"Sync request from screen: {request.ScreenId}");

            if (!Guid.TryParse(request.ScreenId, out var screenGuid))
            {
                return BadRequest(ApiResponse<SyncResponse>.ErrorResponse("Invalid screen ID"));
            }

            var screen = await _screenRepository.GetByIdAsync(screenGuid);
            if (screen == null)
            {
                return NotFound(ApiResponse<SyncResponse>.ErrorResponse("Screen not found"));
            }

            // Reject sync for unverified screens
            if (screen.VerificationStatus != ScreenVerificationStatus.Verified)
            {
                return StatusCode(403, ApiResponse<SyncResponse>.ErrorResponse(
                    "Screen requires verification before it can sync impressions. " +
                    "Please complete the QR verification process."));
            }

            if (!VerifyApiKey(screen, request.ApiKey))
            {
                _logger.LogWarning("Sync rejected: invalid API key for screen {ScreenId}", request.ScreenId);
                return Unauthorized(ApiResponse<SyncResponse>.ErrorResponse("Invalid API key"));
            }

            // Update screen status
            screen.LastSeenAt = DateTime.UtcNow;
            screen.IsOnline = true;
            await _screenRepository.UpdateAsync(screen);

            // Save impressions with deduplication
            int savedCount = 0;
            int duplicateCount = 0;
            var playerVersion = request.SyncData.PlayerVersion ?? "unknown";
            
            // NEW: Handle flat impressions array with SlotPlayKey UPSERT (preferred)
            if (request.SyncData.Impressions != null && request.SyncData.Impressions.Count > 0)
            {
                _logger.LogInformation($"Processing {request.SyncData.Impressions.Count} flat impressions with UPSERT deduplication");
                
                foreach (var imp in request.SyncData.Impressions)
                {
                    // Check for duplicate using SlotPlayKey (most reliable deduplication)
                    if (!string.IsNullOrEmpty(imp.SlotPlayKey))
                    {
                        var existingByKey = await _impressionRepository.FindAsync(x => x.SlotPlayKey == imp.SlotPlayKey);
                        if (existingByKey.Any())
                        {
                            duplicateCount++;
                            _logger.LogDebug($"Skipping duplicate impression (SlotPlayKey: {imp.SlotPlayKey[..16]}...)");
                            continue;
                        }
                    }
                    // Fallback: Check by ImpressionId
                    else if (!string.IsNullOrEmpty(imp.ImpressionId))
                    {
                        var existingById = await _impressionRepository.FindAsync(x => x.ImpressionId == imp.ImpressionId);
                        if (existingById.Any())
                        {
                            duplicateCount++;
                            continue;
                        }
                    }
                    
                    // Basic fraud detection: check if timestamp is reasonable
                    var timeDiff = (DateTime.UtcNow - imp.PlayedAt).TotalHours;
                    var isVerified = timeDiff <= 24 && timeDiff >= -1;
                    
                    if (!isVerified)
                    {
                        _logger.LogWarning($"Suspicious impression timestamp: {imp.PlayedAt} (diff: {timeDiff:F1}h)");
                    }
                    
                    // Validate OwnerContentId exists (to avoid FK constraint violation on hard-deleted content)
                    Guid? validOwnerContentId = null;
                    if (imp.OwnerContentId.HasValue)
                    {
                        // Lazy load valid owner content IDs for this request
                        if (_validOwnerContentIds == null)
                        {
                            var allOwnerContent = await _ownerContentRepository.GetAllAsync();
                            _validOwnerContentIds = new HashSet<Guid>(allOwnerContent.Select(oc => oc.Id));
                        }
                        
                        if (_validOwnerContentIds.Contains(imp.OwnerContentId.Value))
                        {
                            validOwnerContentId = imp.OwnerContentId.Value;
                        }
                        else
                        {
                            _logger.LogWarning($"Ignoring invalid OwnerContentId {imp.OwnerContentId} - content may have been deleted");
                        }
                    }
                    
                    // Ensure all DateTime values have Kind=UTC for PostgreSQL
                    var playedAtUtc = DateTime.SpecifyKind(imp.PlayedAt, DateTimeKind.Utc);
                    var sessionDateUtc = DateTime.SpecifyKind(imp.PlayedAt.Date, DateTimeKind.Utc);
                    
                    var impression = new Impression
                    {
                        Id = Guid.NewGuid(),
                        ScreenId = screenGuid,
                        BookingId = imp.BookingId,
                        CampaignId = imp.CampaignId,
                        CreativeId = imp.CreativeId,
                        OwnerContentId = validOwnerContentId, // Use validated ID
                        SlotPosition = imp.SlotNumber,
                        PlayedAt = playedAtUtc,
                        SessionDate = sessionDateUtc,
                        DeviceId = request.ScreenId,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                        // Deduplication fields
                        ImpressionId = imp.ImpressionId,
                        SlotPlayKey = imp.SlotPlayKey,
                        ClientTimestamp = playedAtUtc,
                        VerificationHash = imp.VerificationHash,
                        PlayerVersion = playerVersion,
                        IsVerified = isVerified,
                        // Playback duration tracking (for advertiser reporting)
                        DurationSeconds = imp.DurationSeconds,
                        ExpectedDurationSeconds = imp.ExpectedDurationSeconds,
                        WasFullPlay = imp.WasFullPlay
                    };

                    await _impressionRepository.AddAsync(impression);
                    savedCount++;
                    
                    // Broadcast for real-time updates (dashboard only, no DB write)
                    if (imp.OwnerContentId.HasValue)
                    {
                        await _hubContext.Clients.Group($"screen_{request.ScreenId}")
                            .SendAsync("ImpressionRecorded", new
                            {
                                screenId = request.ScreenId,
                                slotNumber = imp.SlotNumber,
                                ownerContentId = imp.OwnerContentId,
                                timestamp = imp.PlayedAt
                            });
                    }
                }
            }
            // LEGACY: Handle old format (backwards compatibility)
            else
            {
            foreach (var campaign in request.SyncData.CampaignImpressions)
            {
                // Get impression IDs for deduplication if provided
                var impressionIds = campaign.ImpressionIds ?? new List<string>();
                var verificationHashes = campaign.VerificationHashes ?? new List<string>();
                
                for (int i = 0; i < campaign.PlayTimestamps.Count; i++)
                {
                    var timestamp = campaign.PlayTimestamps[i];
                    var impressionId = i < impressionIds.Count ? impressionIds[i] : null;
                    var verificationHash = i < verificationHashes.Count ? verificationHashes[i] : null;
                    
                    // Check for duplicate impression (if impressionId provided)
                    if (!string.IsNullOrEmpty(impressionId))
                    {
                        var existing = await _impressionRepository.FindAsync(imp => imp.ImpressionId == impressionId);
                        if (existing.Any())
                        {
                            duplicateCount++;
                            _logger.LogDebug($"Skipping duplicate impression: {impressionId}");
                            continue;
                        }
                    }
                    
                    // Basic fraud detection: check if timestamp is reasonable
                    var timeDiff = (DateTime.UtcNow - timestamp).TotalHours;
                    var isVerified = timeDiff <= 24 && timeDiff >= -1; // Allow 1 hour future for clock drift
                    
                    if (!isVerified)
                    {
                        _logger.LogWarning($"Suspicious impression timestamp: {timestamp} (diff: {timeDiff:F1}h) from screen {request.ScreenId}");
                    }
                    
                    // Ensure all DateTime values have Kind=UTC for PostgreSQL
                    var playedAtUtc = DateTime.SpecifyKind(timestamp, DateTimeKind.Utc);
                    var sessionDateUtc = DateTime.SpecifyKind(timestamp.Date, DateTimeKind.Utc);
                    
                    var impression = new Impression
                    {
                        Id = Guid.NewGuid(),
                        ScreenId = screenGuid,
                        BookingId = campaign.BookingId,
                        CampaignId = campaign.CampaignId,
                        CreativeId = campaign.CreativeId,
                        PlayedAt = playedAtUtc,
                        SessionDate = sessionDateUtc,
                        DeviceId = request.ScreenId,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                        // New deduplication fields
                        ImpressionId = impressionId,
                        ClientTimestamp = playedAtUtc,
                        VerificationHash = verificationHash,
                        PlayerVersion = playerVersion,
                        IsVerified = isVerified
                    };

                    await _impressionRepository.AddAsync(impression);
                    savedCount++;
                }
            }

            // Save owner content impressions with deduplication
            foreach (var ownerContent in request.SyncData.OwnerContentImpressions)
            {
                // Validate OwnerContentId exists (to avoid FK constraint violation on hard-deleted content)
                if (_validOwnerContentIds == null)
                {
                    var allOwnerContent = await _ownerContentRepository.GetAllAsync();
                    _validOwnerContentIds = new HashSet<Guid>(allOwnerContent.Select(oc => oc.Id));
                }
                
                if (!_validOwnerContentIds.Contains(ownerContent.OwnerContentId))
                {
                    _logger.LogWarning($"Skipping impressions for invalid OwnerContentId {ownerContent.OwnerContentId} - content may have been deleted");
                    continue;
                }
                
                var impressionIds = ownerContent.ImpressionIds ?? new List<string>();
                var verificationHashes = ownerContent.VerificationHashes ?? new List<string>();
                
                for (int i = 0; i < ownerContent.PlayTimestamps.Count; i++)
                {
                    var timestamp = ownerContent.PlayTimestamps[i];
                    var impressionId = i < impressionIds.Count ? impressionIds[i] : null;
                    var verificationHash = i < verificationHashes.Count ? verificationHashes[i] : null;
                    
                    // Check for duplicate
                    if (!string.IsNullOrEmpty(impressionId))
                    {
                        var existing = await _impressionRepository.FindAsync(imp => imp.ImpressionId == impressionId);
                        if (existing.Any())
                        {
                            duplicateCount++;
                            continue;
                        }
                    }
                    
                    // Ensure all DateTime values have Kind=UTC for PostgreSQL
                    var playedAtUtc = DateTime.SpecifyKind(timestamp, DateTimeKind.Utc);
                    var sessionDateUtc = DateTime.SpecifyKind(timestamp.Date, DateTimeKind.Utc);
                    
                    var impression = new Impression
                    {
                        Id = Guid.NewGuid(),
                        ScreenId = screenGuid,
                        OwnerContentId = ownerContent.OwnerContentId,
                        BookingId = null,
                        CampaignId = null,
                        CreativeId = null,
                        PlayedAt = playedAtUtc,
                        SessionDate = sessionDateUtc,
                        DeviceId = request.ScreenId,
                        SlotPosition = ownerContent.SlotNumber,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                        ImpressionId = impressionId,
                        ClientTimestamp = playedAtUtc,
                        VerificationHash = verificationHash,
                        PlayerVersion = playerVersion,
                        IsVerified = true
                    };

                    await _impressionRepository.AddAsync(impression);
                    savedCount++;
                    
                    // Broadcast impression event for real-time updates
                    // Note: Use underscore to match PlaybackHub group naming convention
                    await _hubContext.Clients.Group($"screen_{request.ScreenId}")
                        .SendAsync("ImpressionRecorded", new
                        {
                            screenId = request.ScreenId,
                            slotNumber = ownerContent.SlotNumber,
                            ownerContentId = ownerContent.OwnerContentId,
                            timestamp = timestamp
                        });
                }
            }
            } // End of legacy format else block

            // Broadcast sync event to dashboard
            // Note: Use underscore to match PlaybackHub group naming convention
            await _hubContext.Clients.Group($"screen_{request.ScreenId}")
                .SendAsync("OnPlayerSync", new
                {
                    screenId = request.ScreenId,
                    uptime = request.SyncData.Uptime,
                    impressionCount = savedCount,
                    timestamp = DateTime.UtcNow
                });

            _logger.LogInformation($"Sync successful for screen {request.ScreenId}: {savedCount} impressions saved, {duplicateCount} duplicates skipped");

            var response = new SyncResponse
            {
                Success = true,
                Message = "Sync successful",
                ImpressionsSaved = savedCount,
                DuplicatesSkipped = duplicateCount,
                DuplicatesIgnored = duplicateCount  // Alias for player compatibility
            };

            return Ok(ApiResponse<SyncResponse>.SuccessResponse(response));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync error for screen {ScreenId}", request.ScreenId);
            return StatusCode(500, ApiResponse<SyncResponse>.ErrorResponse("Sync failed."));
        }
    }

    /// <summary>
    /// Player heartbeat - called every 30 seconds to maintain online status
    /// </summary>
    [HttpPost("heartbeat")]
    public async Task<ActionResult<ApiResponse<HeartbeatResponse>>> Heartbeat([FromBody] HeartbeatRequest request)
    {
        try
        {
            if (!Guid.TryParse(request.ScreenId, out var screenGuid))
            {
                return BadRequest(ApiResponse<HeartbeatResponse>.ErrorResponse("Invalid screen ID"));
            }

            var screen = await _screenRepository.GetByIdAsync(screenGuid);
            if (screen == null)
            {
                return NotFound(ApiResponse<HeartbeatResponse>.ErrorResponse("Screen not found"));
            }

            if (!VerifyApiKey(screen, request.ApiKey))
            {
                _logger.LogWarning("Heartbeat rejected: invalid API key for screen {ScreenId}", request.ScreenId);
                return Unauthorized(ApiResponse<HeartbeatResponse>.ErrorResponse("Invalid API key"));
            }

            // Update last seen timestamp
            var wasOffline = !screen.IsOnline;
            screen.LastSeenAt = DateTime.UtcNow;
            screen.IsOnline = true;
            await _screenRepository.UpdateAsync(screen);

            // If screen was offline and now online, broadcast status change
            if (wasOffline)
            {
                _logger.LogInformation($"Screen {request.ScreenId} came online");
                await _hubContext.Clients.All
                    .SendAsync("ScreenStatusChanged", new
                    {
                        screenId = request.ScreenId,
                        isOnline = true,
                        lastSeen = screen.LastSeenAt,
                        timestamp = DateTime.UtcNow
                    });
            }

            var response = new HeartbeatResponse
            {
                Success = true,
                ServerTime = DateTime.UtcNow
            };

            return Ok(ApiResponse<HeartbeatResponse>.SuccessResponse(response));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Heartbeat error for screen {ScreenId}", request.ScreenId);
            return StatusCode(500, ApiResponse<HeartbeatResponse>.ErrorResponse("Heartbeat failed."));
        }
    }
}

// Request/Response DTOs
public class HandshakeRequest
{
    public string ScreenId { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string? ApiKeyHash { get; set; }  // SHA256 hash for secure verification
    public string? DeviceFingerprint { get; set; }  // Device binding
    public string? Nonce { get; set; }  // For replay protection
    public long? Timestamp { get; set; }  // Unix timestamp
    public string PlayerVersion { get; set; } = string.Empty;
}

public class SyncRequest
{
    public string ScreenId { get; set; } = string.Empty;
    public string? ApiKey { get; set; }
    public DailySyncData SyncData { get; set; } = null!;
}

public class HeartbeatRequest
{
    public string ScreenId { get; set; } = string.Empty;
    public string? ApiKey { get; set; }
}

public class HeartbeatResponse
{
    public bool Success { get; set; }
    public DateTime ServerTime { get; set; }
}
