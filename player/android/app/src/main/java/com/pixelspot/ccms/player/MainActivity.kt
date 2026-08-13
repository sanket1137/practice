package com.pixelspot.ccms.player

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.media3.ui.PlayerView
import com.pixelspot.ccms.player.config.PlayerConfig
import com.pixelspot.ccms.player.data.remote.SignalRClient
import com.pixelspot.ccms.player.data.repository.PlayerRepository
import com.pixelspot.ccms.player.kiosk.KioskManager
import com.pixelspot.ccms.player.streaming.WebRTCStreamer
import com.pixelspot.ccms.player.player.ExoPlayerManager
import com.pixelspot.ccms.player.player.PlayerState
import com.pixelspot.ccms.player.player.PlayerStateManager
import com.pixelspot.ccms.player.service.PlayerService
import com.pixelspot.ccms.player.ui.setup.SetupActivity
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Main activity — full-screen ExoPlayer for ad video playback.
 *
 * On first launch (no config), redirects to [SetupActivity].
 * After setup, shows full-screen PlayerView and starts [PlayerService].
 *
 * In kiosk mode (device owner), this activity is locked to the screen:
 * no home, back, or recent apps buttons work.
 *
 * Debug Overlay:
 * Press MENU key on the remote (or 'M' on keyboard) to toggle a translucent
 * overlay showing: Screen ID, playlist status, impressions, and SignalR state.
 * The overlay auto-refreshes every 2 seconds while visible.
 */
@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "MainActivity"
        private const val OVERLAY_REFRESH_MS = 2_000L
    }

    @Inject lateinit var playerConfig: PlayerConfig
    @Inject lateinit var kioskManager: KioskManager
    @Inject lateinit var exoPlayerManager: ExoPlayerManager
    @Inject lateinit var playerRepository: PlayerRepository
    @Inject lateinit var signalRClient: SignalRClient
    @Inject lateinit var webRTCStreamer: WebRTCStreamer
    @Inject lateinit var playerStateManager: PlayerStateManager

    private lateinit var playerView: PlayerView

    // Loading overlay views
    private lateinit var loadingOverlay: LinearLayout
    private lateinit var loadingMessage: TextView
    private lateinit var loadingStatus: TextView
    private lateinit var loadingSpinner: ProgressBar

    // Debug overlay views
    private lateinit var debugOverlay: LinearLayout
    private lateinit var overlayScreenId: TextView
    private lateinit var overlayStatus: TextView
    private lateinit var overlayImpressions: TextView
    private lateinit var overlaySignalR: TextView
    private val handler = Handler(Looper.getMainLooper())
    private var overlayVisible = false

    /**
     * ActivityResult launcher for MediaProjection screen capture permission.
     * Stores the result in WebRTCStreamer for use when viewers connect.
     */
    private val mediaProjectionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK && result.data != null) {
            webRTCStreamer.setMediaProjectionPermission(result.data!!)
            Log.i(TAG, "MediaProjection permission granted for live streaming")
        } else {
            Log.w(TAG, "MediaProjection permission denied — live streaming unavailable")
        }
    }

    private val overlayRefreshRunnable: Runnable = object : Runnable {
        override fun run() {
            if (overlayVisible) {
                refreshOverlay()
                handler.postDelayed(this, OVERLAY_REFRESH_MS)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Redirect to setup if not configured
        if (!playerConfig.isConfigured) {
            startActivity(Intent(this, SetupActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_main)
        playerView = findViewById(R.id.player_view)

        // Bind loading overlay views
        loadingOverlay = findViewById(R.id.loading_overlay)
        loadingMessage = findViewById(R.id.loading_message)
        loadingStatus = findViewById(R.id.loading_status)
        loadingSpinner = findViewById(R.id.loading_spinner)

        // Bind debug overlay views
        debugOverlay = findViewById(R.id.debug_overlay)
        overlayScreenId = findViewById(R.id.overlay_screen_id)
        overlayStatus = findViewById(R.id.overlay_status)
        overlayImpressions = findViewById(R.id.overlay_impressions)
        overlaySignalR = findViewById(R.id.overlay_signalr)

        // Bind ExoPlayer to the view
        exoPlayerManager.initialize()
        playerView.player = exoPlayerManager.getPlayer()

        // Hide player controls (no user interaction needed)
        playerView.useController = false

        // Request MediaProjection permission FIRST — before the service starts.
        requestMediaProjectionPermission()

        // Start the foreground service (heartbeat, sync, SignalR, playlist)
        startPlayerService()

        // Observe player state to show/hide loading overlay
        observePlayerState()

        // Show screen ID on loading overlay
        loadingStatus.text = "Screen: ${playerConfig.screenId?.take(8) ?: "N/A"}..."

        Log.i(TAG, "MainActivity created, screen=${playerConfig.screenId}")
    }

    /**
     * Observe player state changes and update loading overlay accordingly.
     */
    private fun observePlayerState() {
        lifecycleScope.launch {
            playerStateManager.state.collectLatest { state ->
                updateLoadingOverlay(state)
            }
        }
    }

    /**
     * Update loading overlay based on current player state.
     */
    private fun updateLoadingOverlay(state: PlayerState) {
        if (state.shouldShowLoadingOverlay) {
            loadingOverlay.visibility = View.VISIBLE
            loadingMessage.text = state.loadingMessage

            // Show/hide spinner based on state type
            loadingSpinner.visibility = when (state) {
                is PlayerState.Error -> View.GONE
                else -> View.VISIBLE
            }

            // Update secondary status
            loadingStatus.text = when (state) {
                is PlayerState.Error -> "Screen: ${playerConfig.screenId?.take(8) ?: "N/A"}"
                is PlayerState.NoContent -> "Using default branding video"
                else -> "Screen: ${playerConfig.screenId?.take(8) ?: "N/A"}..."
            }
        } else {
            loadingOverlay.visibility = View.GONE
        }
    }

    override fun onResume() {
        super.onResume()
        // Enter kiosk mode on every resume
        kioskManager.enterKioskMode(this)
        // Re-bind player in case it was recreated
        playerView.player = exoPlayerManager.getPlayer()
    }

    override fun onPause() {
        super.onPause()
        // Stop overlay updates when paused
        handler.removeCallbacks(overlayRefreshRunnable)
    }

    override fun onDestroy() {
        handler.removeCallbacks(overlayRefreshRunnable)
        super.onDestroy()
    }

    /**
     * Block back button in kiosk mode.
     */
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (kioskManager.isDeviceOwner()) {
            // Blocked — kiosk mode
            return
        }
        @Suppress("DEPRECATION")
        super.onBackPressed()
    }

    /**
     * Handle key events. MENU key toggles debug overlay.
     */
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        // MENU key (or 'M' on keyboard) toggles debug overlay
        if (keyCode == KeyEvent.KEYCODE_MENU || keyCode == KeyEvent.KEYCODE_M) {
            toggleDebugOverlay()
            return true
        }

        if (kioskManager.isDeviceOwner()) {
            return when (keyCode) {
                KeyEvent.KEYCODE_HOME,
                KeyEvent.KEYCODE_APP_SWITCH,
                KeyEvent.KEYCODE_VOLUME_DOWN,
                KeyEvent.KEYCODE_VOLUME_UP -> true  // Block these keys
                else -> super.onKeyDown(keyCode, event)
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    /**
     * Toggle the debug overlay visibility and start/stop auto-refresh.
     */
    private fun toggleDebugOverlay() {
        overlayVisible = !overlayVisible
        debugOverlay.visibility = if (overlayVisible) View.VISIBLE else View.GONE

        if (overlayVisible) {
            refreshOverlay()
            handler.postDelayed(overlayRefreshRunnable, OVERLAY_REFRESH_MS)
            Log.d(TAG, "Debug overlay shown")
        } else {
            handler.removeCallbacks(overlayRefreshRunnable)
            Log.d(TAG, "Debug overlay hidden")
        }
    }

    /**
     * Update overlay text fields with current state.
     */
    private fun refreshOverlay() {
        val screenId = playerConfig.screenId ?: "N/A"
        val playlist = playerRepository.getPlaylist()
        val player = exoPlayerManager.getPlayer()
        val isPlaying = player?.isPlaying == true
        val currentIndex = player?.currentMediaItemIndex ?: -1

        overlayScreenId.text = "Screen: ${screenId.take(8)}…"
        overlayStatus.text = "Status: ${if (isPlaying) "▶ Playing" else "⏸ Paused"} | " +
                "Item ${currentIndex + 1}/${playlist.size}"
        overlayImpressions.text = "Playlist: ${playlist.size} items | " +
                "Filler: ${playlist.count { it.isFillerContent }}"
        overlaySignalR.text = "SignalR: ${if (signalRClient.isConnected) "🟢 Connected" else "🔴 Disconnected"}"
    }

    /**
     * Request screen capture permission for WebRTC live streaming.
     */
    private fun requestMediaProjectionPermission() {
        if (webRTCStreamer.hasPermission) return
        try {
            val pm = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            mediaProjectionLauncher.launch(pm.createScreenCaptureIntent())
        } catch (e: Exception) {
            Log.w(TAG, "MediaProjection not available on this device: ${e.message}")
        }
    }

    private fun startPlayerService() {
        val serviceIntent = Intent(this, PlayerService::class.java).apply {
            action = PlayerService.ACTION_START
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
    }
}
