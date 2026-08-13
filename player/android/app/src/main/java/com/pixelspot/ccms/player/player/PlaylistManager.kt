package com.pixelspot.ccms.player.player

import android.util.Log
import com.pixelspot.ccms.player.CcmsPlayerApp
import com.pixelspot.ccms.player.data.model.AdPlaybackEvent
import com.pixelspot.ccms.player.data.model.PlaylistItem
import com.pixelspot.ccms.player.data.remote.SignalRClient
import com.pixelspot.ccms.player.data.repository.ImpressionRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import androidx.media3.common.Player
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages playlist sequencing, operating schedule enforcement, and impression recording.
 *
 * Connects ExoPlayer item transitions to the impression store via callbacks.
 * Enforces operating hours from the handshake response (Mon-Sun schedule).
 *
 * **Impression Guarding**: Impressions are ONLY recorded when the app is in
 * foreground (visible on TV). This prevents billing for impressions that
 * users can't see (e.g., when app is in background). Uses [CcmsPlayerApp.isAppInForeground].
 */
@Singleton
class PlaylistManager @Inject constructor(
    private val exoPlayerManager: ExoPlayerManager,
    private val impressionRepository: ImpressionRepository,
    private val signalRClient: SignalRClient
) {

    companion object {
        private const val TAG = "PlaylistManager"
        /**
         * Remote fallback video played when no content is available.
         * Same R2-hosted universal branding loop used by the backend.
         */
        private const val REMOTE_FALLBACK_URL =
            "https://pub-8b275ed0704741b798c135d2ba0f55f9.r2.dev/Pixel_Universal.mp4"
    }

    private var currentItems: List<PlaylistItem> = emptyList()
    private var screenId: String = ""
    private var timezone: ZoneId = ZoneId.of("Asia/Kolkata")
    private var operatingHours: Map<String, String>? = null
    private var itemStartTimes: MutableMap<Int, Instant> = mutableMapOf()
    private val scope = CoroutineScope(Dispatchers.IO)

    // ── Seamless playlist swap (matches Pi player's _pending_playlist pattern) ──
    private var pendingItems: List<PlaylistItem>? = null
    private var pendingScreenId: String? = null
    private var pendingTimezone: String? = null
    private var pendingOperatingHours: Map<String, String>? = null
    private var slotsPerFrame: Int = 6

    /** Current video URLs in the active playlist (for cache-diff on update). */
    val currentVideoUrls: List<String>
        get() = currentItems.map { it.videoUrl }

    /**
     * Load a new playlist and start playback.
     *
     * Filters out items with blank video URLs to keep [currentItems] indices
     * aligned with ExoPlayer's media item indices — essential for correct
     * impression recording in [onItemTransition].
     *
     * Falls back to a locally bundled branding video when the playlist is
     * empty or all URLs are blank, ensuring the screen never shows black.
     */
    fun loadPlaylist(
        items: List<PlaylistItem>,
        screenId: String,
        timezone: String,
        operatingHours: Map<String, String>?,
        slotsPerFrame: Int = items.size
    ) {
        this.screenId = screenId
        this.timezone = ZoneId.of(timezone)
        this.operatingHours = operatingHours
        this.slotsPerFrame = slotsPerFrame

        // Check operating hours
        if (!isWithinOperatingHours()) {
            Log.i(TAG, "Outside operating hours, pausing playback")
            this.currentItems = items  // cache for when hours start
            exoPlayerManager.pause()
            return
        }

        // Filter to items with valid video URLs — keeps currentItems[i] == ExoPlayer index i
        val validItems = items.filter { it.videoUrl.isNotBlank() }
        this.currentItems = validItems

        if (validItems.isEmpty()) {
            Log.w(TAG, "No valid video URLs in playlist, falling back to remote default")
            exoPlayerManager.loadPlaylist(listOf(REMOTE_FALLBACK_URL))
            return
        }

        val urls = validItems.map { it.videoUrl }
        Log.d(TAG, "Video URLs to load: ${urls.joinToString(", ")}")

        exoPlayerManager.loadPlaylist(urls)

        // Track when each item begins playing for duration calculation
        itemStartTimes[0] = Instant.now()

        // Emit AdStarted for the first item (matches Pi's emit_ad_started on video_start)
        if (validItems.isNotEmpty() && !validItems[0].isFillerContent) {
            emitAdStarted(validItems[0])
        }

        // Set up impression recording on item transitions (with reason for cycle boundary detection)
        exoPlayerManager.setOnItemTransition { previousIndex, newIndex, _ ->
            onItemTransition(previousIndex, newIndex)
        }

        Log.i(TAG, "Loaded ${validItems.size} items for screen $screenId")
    }

    /**
     * Called when ExoPlayer transitions from one item to the next.
     * Records an impression for the completed item and checks for cycle-boundary swap.
     *
     * **Impression Guarding**: Impressions are ONLY recorded when:
     * 1. The app is in foreground (UI visible on TV)
     * 2. Content is not filler/default
     * If the app is in background, impressions are skipped to prevent false billing.
     *
     * Cycle-boundary detection: with REPEAT_MODE_ALL, ExoPlayer emits REASON_AUTO
     * (not REASON_REPEAT) when wrapping from last → first. We detect the wrap
     * purely by index (newIndex < completedIndex, or last → 0).
     */
    private fun onItemTransition(completedIndex: Int, newIndex: Int) {
        if (completedIndex < 0 || completedIndex >= currentItems.size) return

        val item = currentItems[completedIndex]
        val startTime = itemStartTimes[completedIndex] ?: Instant.now()
        val endTime = Instant.now()
        val actualDuration = (endTime.epochSecond - startTime.epochSecond).toInt()

        // Track start time for the new item
        itemStartTimes[newIndex] = endTime

        // Emit AdStarted for the new item (matches Pi's emit_ad_started on every video start)
        if (newIndex in currentItems.indices && !currentItems[newIndex].isFillerContent) {
            emitAdStarted(currentItems[newIndex])
        }

        // ══════════════════════════════════════════════════════════════════════
        // IMPRESSION GUARDING: Only record impressions when app is in foreground
        // ══════════════════════════════════════════════════════════════════════
        //
        // Critical business rule: Impressions should only be counted when the
        // player UI is actively visible on the TV screen. If the app is running
        // in background (e.g., user pressed Home), impressions must NOT be
        // recorded to prevent false billing.
        //
        // This matches Raspberry Pi behavior where impressions are only counted
        // when the display is actually showing the content.
        // ══════════════════════════════════════════════════════════════════════

        // Detect cycle boundary: wrap from last item back to first.
        // Note: with REPEAT_MODE_ALL, ExoPlayer emits MEDIA_ITEM_TRANSITION_REASON_AUTO
        // on wrap (REASON_REPEAT is only for REPEAT_MODE_ONE). Detect wrap by index
        // going backwards (newIndex < completedIndex) which reliably indicates a wrap.
        val isCycleBoundary = newIndex < completedIndex ||
            (completedIndex == currentItems.size - 1 && newIndex == 0)

        if (!CcmsPlayerApp.isAppInForeground) {
            Log.w(TAG, "⚠️ Skipping impression — app is NOT in foreground (slot ${item.slotNumber})")
            // Still process cycle-boundary swap even when in background
            if (isCycleBoundary && pendingItems != null) {
                applyPendingPlaylist()
            }
            return
        }

        // Skip impressions for default/filler content — only count real bookings/owner content
        // Matches Pi player's record_impression() guard: `if is_filler: return`
        if (item.isFillerContent) {
            Log.d(TAG, "Skipping impression for filler/default content (slot ${item.slotNumber})")
        } else {
            // Record impression for non-filler content (app is in foreground)
            scope.launch {
                try {
                    val impressionId = impressionRepository.recordImpression(
                        screenId = screenId,
                        item = item,
                        playedAt = startTime,
                        durationSeconds = actualDuration,
                        expectedDurationSeconds = item.durationSeconds,
                        wasFullPlay = actualDuration >= (item.durationSeconds * 0.9).toInt(),
                        timezone = timezone
                    )

                    // Send real-time event via SignalR
                    if (impressionId != null) {
                        Log.i(TAG, "✓ Impression recorded (foreground): slot ${item.slotNumber}, id=$impressionId")
                        val event = AdPlaybackEvent(
                            screenId = screenId,
                            bookingId = item.bookingId,
                            campaignId = item.campaignId,
                            creativeId = item.creativeId,
                            ownerContentId = item.ownerContentId,
                            slotNumber = item.slotNumber,
                            playedAt = startTime.toString(),
                            impressionId = impressionId,
                            slotPlayKey = "",
                            durationSeconds = actualDuration,
                            wasFullPlay = actualDuration >= (item.durationSeconds * 0.9).toInt()
                        )
                        signalRClient.sendAdCompleted(event)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to record impression: ${e.message}", e)
                }
            }
        }

        // ── Cycle-boundary swap: apply pending playlist when cycle completes ──
        // Detected by index wrap (newIndex < completedIndex) since REPEAT_MODE_ALL
        // emits REASON_AUTO (not REASON_REPEAT) when wrapping the playlist.
        if (isCycleBoundary && pendingItems != null) {
            applyPendingPlaylist()
        }
    }

    /**
     * Buffer a playlist update for seamless cycle-boundary swap.
     *
     * Instead of disrupting playback mid-cycle, the new playlist is stored
     * as pending and applied when the current cycle completes (last item
     * transitions back to first via REPEAT mode).
     *
     * Mirrors Pi player's _refresh_playlist() → _pending_playlist pattern.
     *
     * @param slotsPerFrame Number of slots per frame from handshake response
     */
    fun preparePlaylistUpdate(
        items: List<PlaylistItem>,
        screenId: String,
        timezone: String,
        operatingHours: Map<String, String>?,
        slotsPerFrame: Int
    ) {
        val validItems = items.filter { it.videoUrl.isNotBlank() }
        Log.d(TAG, "📺 preparePlaylistUpdate: ${validItems.size} valid items, isPlaying=${exoPlayerManager.isPlaying}")

        // If nothing is currently playing, apply immediately
        if (currentItems.isEmpty() || !exoPlayerManager.isPlaying) {
            Log.i(TAG, "📺 No active playback, applying playlist update immediately")
            loadPlaylist(items, screenId, timezone, operatingHours, slotsPerFrame)
            return
        }

        // Check if playlist is unchanged
        if (isPlaylistSame(validItems)) {
            Log.i(TAG, "📺 Playlist unchanged, no update needed")
            return
        }
        
        Log.i(TAG, "📺 Playlist has changed! Buffering for cycle-boundary swap")
        
        // Log the differences
        validItems.forEachIndexed { index, item ->
            val oldUrl = currentItems.getOrNull(index)?.videoUrl ?: "NONE"
            val newUrl = item.videoUrl
            if (oldUrl != newUrl) {
                Log.i(TAG, "📺 Slot ${item.slotNumber} changed: ${oldUrl.takeLast(30)} -> ${newUrl.takeLast(30)}")
            }
        }

        // Buffer for cycle-boundary swap
        pendingItems = validItems
        pendingScreenId = screenId
        pendingTimezone = timezone
        pendingOperatingHours = operatingHours
        this.slotsPerFrame = slotsPerFrame

        Log.i(TAG, "Buffered playlist update (${validItems.size} items) — will apply at cycle boundary")

        // Pre-cache new video URLs in background so swap is instant
        val newUrls = validItems.map { it.videoUrl }
        scope.launch {
            exoPlayerManager.preCacheUrls(newUrls)
        }
    }

    /**
     * Check if new playlist items match the current playlist (same slots and URLs).
     */
    private fun isPlaylistSame(newItems: List<PlaylistItem>): Boolean {
        if (newItems.size != currentItems.size) return false
        return newItems.zip(currentItems).all { (new, current) ->
            new.slotNumber == current.slotNumber && new.videoUrl == current.videoUrl
        }
    }

    /**
     * Apply the buffered pending playlist, replacing current playback.
     *
     * Called at cycle boundary (after last item wraps to first).
     * Since videos were pre-cached via [ExoPlayerManager.preCacheUrls],
     * the transition is near-instant (reading from local disk cache).
     */
    private fun applyPendingPlaylist() {
        val pending = pendingItems ?: return

        Log.i(TAG, "Cycle complete — applying pending playlist (${pending.size} items)")

        this.currentItems = pending
        this.screenId = pendingScreenId ?: this.screenId
        this.timezone = ZoneId.of(pendingTimezone ?: this.timezone.id)
        this.operatingHours = pendingOperatingHours ?: this.operatingHours

        // Clear pending state
        pendingItems = null
        pendingScreenId = null
        pendingTimezone = null
        pendingOperatingHours = null

        if (pending.isEmpty()) {
            Log.w(TAG, "Pending playlist empty, falling back to remote default")
            exoPlayerManager.loadPlaylist(listOf(REMOTE_FALLBACK_URL))
            return
        }

        val urls = pending.map { it.videoUrl }
        exoPlayerManager.loadPlaylist(urls)

        // Reset item start tracking
        itemStartTimes.clear()
        itemStartTimes[0] = Instant.now()

        Log.i(TAG, "Playlist swapped seamlessly at cycle boundary (${pending.size} items)")
    }

    /**
     * Whether a playlist update is buffered and waiting for cycle boundary.
     */
    fun hasPendingUpdate(): Boolean = pendingItems != null

    /**
     * Emit AdStarted event via SignalR for real-time dashboard updates.
     * Matches Pi player's emit_ad_started() — fires when each non-filler video begins.
     */
    private fun emitAdStarted(item: PlaylistItem) {
        val event = AdPlaybackEvent(
            screenId = screenId,
            bookingId = item.bookingId,
            campaignId = item.campaignId,
            creativeId = item.creativeId,
            ownerContentId = item.ownerContentId,
            slotNumber = item.slotNumber,
            playedAt = Instant.now().toString(),
            impressionId = "",  // Not yet recorded — impression comes on AdCompleted
            slotPlayKey = "",
            durationSeconds = item.durationSeconds,
            wasFullPlay = false  // Unknown yet — hasn't finished
        )
        signalRClient.sendAdStarted(event)
    }

    /**
     * Check if current time is within the screen's operating hours.
     *
     * Operating hours from handshake: Map<String, String> where
     * key = "Monday".."Sunday", value = "HH:mm-HH:mm" or "closed"
     *
     * Supports overnight schedules (e.g., "22:00-06:00") — when start > end,
     * the schedule wraps past midnight. Matches Pi player's _check_operating_hours.
     */
    fun isWithinOperatingHours(): Boolean {
        val hours = operatingHours ?: return true  // No schedule = always on

        val now = java.time.ZonedDateTime.now(timezone)
        val dayName = when (now.dayOfWeek) {
            DayOfWeek.MONDAY -> "Monday"
            DayOfWeek.TUESDAY -> "Tuesday"
            DayOfWeek.WEDNESDAY -> "Wednesday"
            DayOfWeek.THURSDAY -> "Thursday"
            DayOfWeek.FRIDAY -> "Friday"
            DayOfWeek.SATURDAY -> "Saturday"
            DayOfWeek.SUNDAY -> "Sunday"
        }

        val schedule = hours[dayName] ?: return true
        if (schedule.equals("closed", ignoreCase = true)) return false

        return try {
            val parts = schedule.split("-")
            if (parts.size != 2) return true
            val startTime = LocalTime.parse(parts[0].trim(), DateTimeFormatter.ofPattern("HH:mm"))
            val endTime = LocalTime.parse(parts[1].trim(), DateTimeFormatter.ofPattern("HH:mm"))
            val currentTime = now.toLocalTime()

            if (startTime <= endTime) {
                // Normal schedule: e.g. 08:00-20:00
                currentTime in startTime..endTime
            } else {
                // Overnight schedule: e.g. 22:00-06:00 (wraps past midnight)
                currentTime >= startTime || currentTime <= endTime
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse operating hours: $schedule", e)
            true // Default to operating if schedule is unparseable
        }
    }

    /**
     * Get current playlist items.
     */
    fun getItems(): List<PlaylistItem> = currentItems

    /**
     * Get the item currently playing.
     */
    fun getCurrentItem(): PlaylistItem? {
        val index = exoPlayerManager.currentIndex
        return if (index in currentItems.indices) currentItems[index] else null
    }
}
