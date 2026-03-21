package com.pixelspot.ccms.player.player

import android.util.Log
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
        exoPlayerManager.setOnItemTransition { previousIndex, newIndex, reason ->
            onItemTransition(previousIndex, newIndex, reason)
        }

        Log.i(TAG, "Loaded ${validItems.size} items for screen $screenId")
    }

    /**
     * Called when ExoPlayer transitions from one item to the next.
     * Records an impression for the completed item and checks for cycle-boundary swap.
     *
     * @param reason ExoPlayer transition reason:
     *   - MEDIA_ITEM_TRANSITION_REASON_REPEAT (0) = playlist wrapped (last→first) = cycle boundary
     *   - MEDIA_ITEM_TRANSITION_REASON_AUTO (1) = natural end of item
     *   - MEDIA_ITEM_TRANSITION_REASON_SEEK (2) = manual seek
     */
    private fun onItemTransition(completedIndex: Int, newIndex: Int, reason: Int) {
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

        // Skip impressions for default/filler content — only count real bookings/owner content
        // Matches Pi player's record_impression() guard: `if is_filler: return`
        if (item.isFillerContent) {
            Log.d(TAG, "Skipping impression for filler/default content (slot ${item.slotNumber})")
        } else {
            // Record impression for non-filler content
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
        // MEDIA_ITEM_TRANSITION_REASON_REPEAT (0) = last item wrapped to first
        if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT && pendingItems != null) {
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

        // If nothing is currently playing, apply immediately
        if (currentItems.isEmpty() || !exoPlayerManager.isPlaying) {
            Log.i(TAG, "No active playback, applying playlist update immediately")
            loadPlaylist(items, screenId, timezone, operatingHours, slotsPerFrame)
            return
        }

        // Check if playlist is unchanged
        if (isPlaylistSame(validItems)) {
            Log.i(TAG, "Playlist unchanged, no update needed")
            return
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
