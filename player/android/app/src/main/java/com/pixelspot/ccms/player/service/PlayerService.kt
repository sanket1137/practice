package com.pixelspot.ccms.player.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.pixelspot.ccms.player.CcmsPlayerApp
import com.pixelspot.ccms.player.MainActivity
import com.pixelspot.ccms.player.R
import com.pixelspot.ccms.player.config.PlayerConfig
import com.pixelspot.ccms.player.data.remote.SignalRClient
import com.pixelspot.ccms.player.data.repository.ImpressionRepository
import com.pixelspot.ccms.player.data.repository.PlayerRepository
import com.pixelspot.ccms.player.player.ExoPlayerManager
import com.pixelspot.ccms.player.player.PlaylistManager
import com.pixelspot.ccms.player.player.PlayerStateManager
import com.pixelspot.ccms.player.security.DeviceFingerprint
import com.pixelspot.ccms.player.streaming.StreamingSignalRClient
import com.pixelspot.ccms.player.streaming.WebRTCStreamer
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collectLatest
import javax.inject.Inject

/**
 * Foreground service that orchestrates the entire player lifecycle.
 *
 * Runs persistently (survives Activity destruction, app task removal).
 * Started by [BootReceiver] on device boot or by [MainActivity] on app launch.
 *
 * Manages concurrent loops (same as Pi's asyncio tasks):
 * 1. Heartbeat loop (30s) — POST /api/player/heartbeat
 * 2. Sync loop (1-10 min, adaptive) — POST /api/player/sync
 * 3. Operating hours check loop (1 min) — pause/resume playback
 * 4. **Foreground restoration loop (10s)** — ensures MainActivity is visible on TV
 *
 * **Impression Guarding**: The service ensures the player UI is always visible
 * in foreground on the TV. If the app goes to background, the service will
 * attempt to bring MainActivity back to front. Impressions are NOT counted
 * while the app is in background (see [PlaylistManager]).
 *
 * Also manages:
 * - SignalR connection for real-time events
 * - WakeLock to prevent CPU sleep during playback
 * - Impression cleanup (7-day retention)
 */
@AndroidEntryPoint
class PlayerService : Service() {

    companion object {
        private const val TAG = "PlayerService"
        private const val NOTIFICATION_ID = 1
        private const val CHANNEL_ID = "ccms_player_channel"

        private const val HEARTBEAT_INTERVAL_MS = 30_000L
        private const val SYNC_INTERVAL_NORMAL_MS = 600_000L     // 10 minutes
        private const val SYNC_INTERVAL_FAST_MS = 60_000L        // 1 minute
        private const val OPERATING_CHECK_INTERVAL_MS = 60_000L  // 1 minute
        private const val CLEANUP_INTERVAL_MS = 3_600_000L       // 1 hour
        private const val PLAYLIST_REFRESH_INTERVAL_MS = 60_000L // 1 minute (fallback polling)
        private const val FOREGROUND_CHECK_INTERVAL_MS = 10_000L // 10 seconds (ensure UI visible)

        const val ACTION_START = "com.pixelspot.ccms.player.START"
        const val ACTION_STOP = "com.pixelspot.ccms.player.STOP"
    }

    @Inject lateinit var playerRepository: PlayerRepository
    @Inject lateinit var impressionRepository: ImpressionRepository
    @Inject lateinit var signalRClient: SignalRClient
    @Inject lateinit var exoPlayerManager: ExoPlayerManager
    @Inject lateinit var playlistManager: PlaylistManager
    @Inject lateinit var playerStateManager: PlayerStateManager
    @Inject lateinit var playerConfig: PlayerConfig
    @Inject lateinit var deviceFingerprint: DeviceFingerprint
    @Inject lateinit var webRTCStreamer: WebRTCStreamer
    @Inject lateinit var streamingSignalRClient: StreamingSignalRClient

    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var wakeLock: PowerManager.WakeLock? = null
    private var currentSyncInterval = SYNC_INTERVAL_NORMAL_MS
    private var isRunning = false

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopSelf()
                return START_NOT_STICKY
            }
        }

        if (!isRunning) {
            isRunning = true
            startForeground(NOTIFICATION_ID, createNotification("Starting..."))
            acquireWakeLock()
            startPlayer()
        }

        // Restart service if killed by system
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    /**
     * Main entry point — performs handshake, starts all loops.
     */
    private fun startPlayer() {
        serviceScope.launch {
            // 1. Validate configuration
            val screenId = playerConfig.screenId
            val apiKey = playerConfig.apiKey

            if (screenId.isNullOrBlank() || apiKey.isNullOrBlank()) {
                Log.e(TAG, "No screen_id or api_key configured")
                updateNotification("Not configured — open app to set up")
                return@launch
            }

            updateNotification("Connecting...")

            // 2. Perform handshake
            val response = playerRepository.handshake()
            if (response == null) {
                Log.e(TAG, "Handshake failed, retrying in 30s")
                updateNotification("Connection failed — retrying...")
                delay(30_000)
                startPlayer()  // Retry
                return@launch
            }

            val playlist = playerRepository.getPlaylist()
            Log.i(TAG, "Handshake successful, ${playlist.size} items")

            // Check if screen requires QR verification
            if (response.verificationMode) {
                Log.w(TAG, "Screen requires verification (status: ${response.verificationStatus})")
                updateNotification("Verification required — displaying QR code")

                val verifyIntent = com.pixelspot.ccms.player.verification.QrVerificationActivity.createIntent(this@PlayerService)
                startActivity(verifyIntent)

                // Wait for verification to complete, then re-handshake
                delay(5_000) // Give Activity time to launch
                var verified = false
                while (!verified && isRunning) {
                    delay(10_000)
                    val recheckResponse = playerRepository.handshake()
                    if (recheckResponse != null && !recheckResponse.verificationMode) {
                        verified = true
                        Log.i(TAG, "Screen verified! Proceeding to playback.")
                    }
                }
                if (!isRunning) return@launch

                // Re-handshake to get fresh playlist
                val freshResponse = playerRepository.handshake() ?: return@launch
                val freshPlaylist = playerRepository.getPlaylist()
                updateNotification("Playing — ${freshPlaylist.size} items")

                withContext(Dispatchers.Main) {
                    exoPlayerManager.initialize()
                    
                    // Listen for playback to actually start and hide loading overlay
                    exoPlayerManager.setOnPlaybackStateChanged { isPlaying ->
                        if (isPlaying) {
                            val currentPlaylist = playerRepository.getPlaylist()
                            playerStateManager.setPlaying(currentPlaylist.size)
                            Log.i(TAG, "Playback started (verified), hiding loading overlay")
                        }
                    }
                    
                    playlistManager.loadPlaylist(
                        items = freshPlaylist,
                        screenId = screenId,
                        timezone = freshResponse.screenTimezone ?: "Asia/Kolkata",
                        operatingHours = freshResponse.operatingHours,
                        slotsPerFrame = freshResponse.playlist?.slotsPerFrame ?: freshPlaylist.size
                    )
                }
            } else {
                updateNotification("Playing — ${playlist.size} items")

                // 3. Initialize ExoPlayer and load playlist
                withContext(Dispatchers.Main) {
                    exoPlayerManager.initialize()
                    
                    // Listen for playback to actually start and hide loading overlay
                    exoPlayerManager.setOnPlaybackStateChanged { isPlaying ->
                        if (isPlaying) {
                            val currentPlaylist = playerRepository.getPlaylist()
                            playerStateManager.setPlaying(currentPlaylist.size)
                            Log.i(TAG, "Playback started, hiding loading overlay")
                        }
                    }
                    
                    playlistManager.loadPlaylist(
                        items = playlist,
                        screenId = screenId,
                        timezone = response.screenTimezone ?: "Asia/Kolkata",
                        operatingHours = response.operatingHours,
                        slotsPerFrame = response.playlist?.slotsPerFrame ?: playlist.size
                    )
                }
            }

            // 4. Connect SignalR
            val fingerprint = deviceFingerprint.generate()
            signalRClient.connect(
                serverUrl = playerConfig.serverUrl!!,
                screenId = screenId,
                deviceId = fingerprint.take(16)
            )

            // 5. Initialize WebRTC live streaming (in background, non-blocking)
            launch(Dispatchers.IO) {
                try {
                    initializeStreaming(screenId, fingerprint)
                } catch (e: Exception) {
                    Log.e(TAG, "Streaming initialization failed: ${e.message}", e)
                }
            }

            // 6. Start concurrent loops
            launch { heartbeatLoop() }
            launch { syncLoop() }
            launch { operatingHoursLoop() }
            launch { cleanupLoop() }
            launch { playlistRefreshLoop() }   // Fallback polling (matches Pi's playlist_refresh_loop)
            launch { foregroundRestorationLoop() }  // Ensure UI stays visible on TV
            launch { listenForSyncModeChanges() }
            launch { listenForPlaylistUpdates() }
        }
    }

    /**
     * Heartbeat loop — every 30 seconds.
     * Keeps the screen marked as online in the backend.
     */
    private suspend fun heartbeatLoop() {
        while (isRunning) {
            try {
                playerRepository.sendHeartbeat()
            } catch (e: Exception) {
                Log.w(TAG, "Heartbeat error: ${e.message}")
            }
            delay(HEARTBEAT_INTERVAL_MS)
        }
    }

    /**
     * Sync loop — adaptive interval (1 or 10 minutes).
     * Uploads pending impressions to the server.
     */
    private suspend fun syncLoop() {
        while (isRunning) {
            delay(currentSyncInterval)
            try {
                val result = playerRepository.syncImpressions()
                if (result >= 0) {
                    val stats = impressionRepository.getStats()
                    updateNotification("Playing — ${stats.today} impressions today")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Sync error: ${e.message}")
            }
        }
    }

    /**
     * Operating hours loop — checks every minute.
     * Pauses/resumes playback based on schedule.
     */
    private suspend fun operatingHoursLoop() {
        while (isRunning) {
            delay(OPERATING_CHECK_INTERVAL_MS)
            try {
                val withinHours = playlistManager.isWithinOperatingHours()
                if (withinHours && !exoPlayerManager.isPlaying) {
                    Log.i(TAG, "Entering operating hours, resuming playback")
                    withContext(Dispatchers.Main) { exoPlayerManager.resume() }
                    val playlist = playerRepository.getPlaylist()
                    playerStateManager.setPlaying(playlist.size)
                } else if (!withinHours && exoPlayerManager.isPlaying) {
                    Log.i(TAG, "Outside operating hours, pausing playback")
                    withContext(Dispatchers.Main) { exoPlayerManager.pause() }
                    updateNotification("Paused — outside operating hours")
                    playerStateManager.setPaused("Outside operating hours")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Operating hours check error: ${e.message}")
            }
        }
    }

    /**
     * Cleanup loop — runs hourly.
     * Removes old synced impressions (7-day retention).
     */
    private suspend fun cleanupLoop() {
        while (isRunning) {
            delay(CLEANUP_INTERVAL_MS)
            try {
                impressionRepository.cleanupOldImpressions()
            } catch (e: Exception) {
                Log.w(TAG, "Cleanup error: ${e.message}")
            }
        }
    }

    /**
     * Foreground restoration loop — every 10 seconds.
     *
     * Ensures the player UI (MainActivity) is always visible on the TV screen.
     * If the app goes to background (e.g., user pressed Home on remote), this
     * loop will bring MainActivity back to front.
     *
     * **Critical for impression accuracy**: Impressions are only counted when
     * the app is in foreground. If the UI isn't visible, impressions would be
     * skipped (see PlaylistManager.onItemTransition). This loop ensures the
     * TV always shows the player content and impressions are properly recorded.
     *
     * This is the Android TV equivalent of Raspberry Pi's always-on display
     * behavior where the player is the only visible application.
     */
    private suspend fun foregroundRestorationLoop() {
        // Initial delay to let MainActivity finish launching
        delay(5_000)

        while (isRunning) {
            try {
                if (!CcmsPlayerApp.isAppInForeground) {
                    Log.w(TAG, "⚠️ App not in foreground — bringing MainActivity to front")
                    bringMainActivityToFront()
                }
            } catch (e: Exception) {
                Log.w(TAG, "Foreground restoration error: ${e.message}")
            }
            delay(FOREGROUND_CHECK_INTERVAL_MS)
        }
    }

    /**
     * Launch MainActivity to bring the player UI to foreground.
     *
     * Uses FLAG_ACTIVITY_REORDER_TO_FRONT to bring existing instance to front
     * without recreating it, preserving playback state.
     */
    private fun bringMainActivityToFront() {
        try {
            val intent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("foreground_restore", true)
            }
            startActivity(intent)
            Log.i(TAG, "MainActivity brought to front")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to bring MainActivity to front: ${e.message}", e)
        }
    }

    /**
     * Listen for SetSyncMode events from SignalR.
     * "fast" = 1 minute interval, "normal" = 10 minute interval.
     *
     * Pi player triggers an immediate sync when switching to fast mode
     * so the dashboard gets fresh data without waiting for the next interval.
     */
    private suspend fun listenForSyncModeChanges() {
        signalRClient.syncModeChanged.collectLatest { mode ->
            currentSyncInterval = when (mode.lowercase()) {
                "fast" -> {
                    Log.i(TAG, "Sync mode: fast (1 min) — triggering immediate sync")
                    // Immediate sync so dashboard sees fresh data right away
                    try { playerRepository.syncImpressions() } catch (_: Exception) {}
                    SYNC_INTERVAL_FAST_MS
                }
                else -> {
                    Log.i(TAG, "Sync mode: normal (10 min)")
                    SYNC_INTERVAL_NORMAL_MS
                }
            }
        }
    }

    /**
     * Listen for PlaylistUpdated events from SignalR.
     * Buffers the new playlist for seamless cycle-boundary swap instead of
     * disrupting playback mid-cycle. Matches Pi player's _pending_playlist pattern.
     *
     * Also evicts stale cache entries when content is removed, matching
     * Pi player's _on_playlist_updated() cache invalidation.
     */
    private suspend fun listenForPlaylistUpdates() {
        signalRClient.playlistUpdated.collectLatest { event ->
            Log.i(TAG, "📺 Playlist updated via SignalR: action=${event.action} slot=${event.slotNumber}")
            Log.i(TAG, "📺 Triggering immediate playlist refresh...")
            refreshAndBufferPlaylist()
        }
    }

    /**
     * Playlist refresh polling fallback — runs every 60 seconds.
     * Matches Pi player's playlist_refresh_loop() which catches any
     * SignalR events that were missed during disconnects or network glitches.
     */
    private suspend fun playlistRefreshLoop() {
        while (isRunning) {
            delay(PLAYLIST_REFRESH_INTERVAL_MS)
            try {
                refreshAndBufferPlaylist()
            } catch (e: Exception) {
                Log.w(TAG, "Playlist polling refresh error: ${e.message}")
            }
        }
    }

    /**
     * Core playlist refresh logic used by both SignalR listener and polling fallback.
     * Fetches fresh playlist via handshake, evicts stale cache entries, and
     * buffers new playlist for cycle-boundary swap.
     */
    private suspend fun refreshAndBufferPlaylist() {
        Log.i(TAG, "📺 Refreshing playlist from server...")
        val oldUrls = playlistManager.currentVideoUrls.toSet()
        Log.d(TAG, "Old playlist URLs: ${oldUrls.size} items")

        val response = playerRepository.handshake()
        if (response != null) {
            val updatedPlaylist = playerRepository.getPlaylist()
            val slotsPerFrame = response.playlist?.slotsPerFrame ?: updatedPlaylist.size

            Log.i(TAG, "📺 Server returned ${updatedPlaylist.size} playlist items")
            
            // Log each item for debugging
            updatedPlaylist.forEachIndexed { index, item ->
                Log.d(TAG, "📺 Playlist[$index]: slot=${item.slotNumber}, url=${item.videoUrl.take(50)}...")
            }

            // Evict cache entries for URLs that disappeared (content removed server-side).
            // Matches Pi player's _clear_slot_cache() pattern.
            val newUrls = updatedPlaylist.filter { it.videoUrl.isNotBlank() }
                .map { it.videoUrl }.toSet()
            val removedUrls = oldUrls - newUrls
            if (removedUrls.isNotEmpty()) {
                Log.i(TAG, "📺 Evicting ${removedUrls.size} removed URLs from cache")
                exoPlayerManager.evictCachedUrls(removedUrls.toList())
            }
            
            // Check for new URLs
            val addedUrls = newUrls - oldUrls
            if (addedUrls.isNotEmpty()) {
                Log.i(TAG, "📺 New URLs detected: ${addedUrls.size}")
            }

            withContext(Dispatchers.Main) {
                playlistManager.preparePlaylistUpdate(
                    items = updatedPlaylist,
                    screenId = playerConfig.screenId!!,
                    timezone = response.screenTimezone ?: "Asia/Kolkata",
                    operatingHours = response.operatingHours,
                    slotsPerFrame = slotsPerFrame
                )
            }
            
            val status = if (playlistManager.hasPendingUpdate()) " (update pending)" else ""
            Log.i(TAG, "📺 Playlist refresh complete: ${updatedPlaylist.size} items$status")
            updateNotification("Playing — ${updatedPlaylist.size} items$status")
        } else {
            Log.w(TAG, "📺 Playlist refresh failed - handshake returned null")
        }
    }

    // ── WebRTC Live Streaming ──

    /**
     * Initialize WebRTC streaming infrastructure.
     *
     * Sets up the signaling pipeline between StreamingSignalRClient and
     * WebRTCStreamer. When a dashboard viewer connects via the streaming hub,
     * the pipeline automatically creates PeerConnection, generates offer,
     * exchanges ICE candidates, and starts streaming screen capture.
     *
     * Mirrors Pi player's simple_webrtc_client.py start() flow.
     */
    private fun initializeStreaming(screenId: String, deviceId: String) {
        try {
            Log.i(TAG, "Initializing WebRTC streaming for screen $screenId")

            // Initialize WebRTC with Google STUN servers (TURN added in appsettings.json)
            webRTCStreamer.initialize(listOf(
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302"
            ))
            Log.i(TAG, "WebRTC PeerConnectionFactory initialized")

            // Connect to streaming SignalR hub
            Log.i(TAG, "Connecting to streaming SignalR hub at ${playerConfig.serverUrl}/hubs/streaming")
            streamingSignalRClient.connect(
                serverUrl = playerConfig.serverUrl!!,
                screenId = screenId,
                apiKey = playerConfig.apiKey ?: "test-key"
            )
            Log.i(TAG, "StreamingSignalRClient connection initiated")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize streaming: ${e.message}", e)
            return
        }

        // Wire signaling: StreamingHub events → WebRTCStreamer
        streamingSignalRClient.onViewerConnected = { viewerId ->
            serviceScope.launch(Dispatchers.Main) {
                webRTCStreamer.addViewer(viewerId)
            }
        }
        streamingSignalRClient.onAnswer = { viewerId, sdpType, sdpContent ->
            webRTCStreamer.handleAnswer(viewerId, sdpType, sdpContent)
        }
        streamingSignalRClient.onViewerIceCandidate = { viewerId, candidate, sdpMid, idx ->
            webRTCStreamer.handleIceCandidate(viewerId, candidate, sdpMid, idx)
        }
        streamingSignalRClient.onViewerDisconnected = { viewerId ->
            webRTCStreamer.removeViewer(viewerId)
        }

        // Wire signaling: WebRTCStreamer → StreamingHub
        webRTCStreamer.onLocalOffer = { viewerId, sdpType, sdpContent ->
            streamingSignalRClient.sendOffer(viewerId, sdpType, sdpContent)
        }
        webRTCStreamer.onLocalIceCandidate = { viewerId, candidate, sdpMid, idx ->
            streamingSignalRClient.sendIceCandidate(viewerId, candidate, sdpMid, idx)
        }

        Log.i(TAG, "WebRTC streaming infrastructure initialized")
    }

    // ── Wake Lock ──

    private fun acquireWakeLock() {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "CcmsPlayer::PlayerService"
        ).apply {
            acquire()
        }
        Log.d(TAG, "WakeLock acquired")
    }

    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
        wakeLock = null
        Log.d(TAG, "WakeLock released")
    }

    // ── Notification ──

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "CCMS Player",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Digital signage player status"
                setShowBadge(false)
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
    }

    private fun createNotification(status: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("CCMS Player")
            .setContentText(status)
            .setSmallIcon(R.drawable.ic_notification)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun updateNotification(status: String) {
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(NOTIFICATION_ID, createNotification(status))
    }

    // ── Lifecycle ──

    override fun onDestroy() {
        isRunning = false
        serviceScope.cancel()
        webRTCStreamer.release()
        streamingSignalRClient.disconnect()
        signalRClient.disconnect()
        exoPlayerManager.release()
        releaseWakeLock()

        // Final sync before shutdown
        CoroutineScope(Dispatchers.IO).launch {
            try {
                playerRepository.syncImpressions()
            } catch (_: Exception) { }
        }

        Log.i(TAG, "PlayerService destroyed")
        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // Service survives app task removal (START_STICKY + foreground notification)
        Log.d(TAG, "Task removed, service continues running")
        super.onTaskRemoved(rootIntent)
    }
}
