package com.pixelspot.ccms.player.data.remote

import android.util.Log
import com.microsoft.signalr.HubConnection
import com.microsoft.signalr.HubConnectionBuilder
import com.microsoft.signalr.HubConnectionState
import com.pixelspot.ccms.player.data.model.AdPlaybackEvent
import com.pixelspot.ccms.player.data.model.SlotStatusChangedEvent
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

/**
 * SignalR client for real-time communication with the CCMS backend.
 *
 * Connects to /hubs/playback and handles:
 * - PlaylistUpdated: triggers playlist refresh
 * - SlotStatusChanged: booking/content changes
 * - SetSyncMode: switches between fast (1 min) and normal (10 min) sync
 * - ScreenStatusChanged: screen online/offline broadcasts
 *
 * Also sends:
 * - RegisterDevice: on connect
 * - AdStarted / AdCompleted: real-time impression events
 */
@Singleton
class SignalRClient @Inject constructor() {

    companion object {
        private const val TAG = "SignalRClient"
        private const val HUB_PATH = "/hubs/playback"
        private const val MAX_RECONNECT_DELAY_MS = 60_000L
        private const val INITIAL_RECONNECT_DELAY_MS = 5_000L
    }

    private var hubConnection: HubConnection? = null
    private var reconnectJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // ── Events emitted to the player service ──

    /**
     * Emits parsed PlaylistUpdated event data: { action, slotNumber, screenId }.
     * Receivers use this to invalidate caches and re-fetch playlist.
     */
    private val _playlistUpdated = MutableSharedFlow<PlaylistUpdatedEvent>(extraBufferCapacity = 1)
    val playlistUpdated: SharedFlow<PlaylistUpdatedEvent> = _playlistUpdated

    data class PlaylistUpdatedEvent(
        val action: String = "Unknown",
        val slotNumber: Int = 0,
        val screenId: String = ""
    )

    private val _slotStatusChanged = MutableSharedFlow<SlotStatusChangedEvent>(extraBufferCapacity = 5)
    val slotStatusChanged: SharedFlow<SlotStatusChangedEvent> = _slotStatusChanged

    private val _syncModeChanged = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val syncModeChanged: SharedFlow<String> = _syncModeChanged

    private var serverUrl: String = ""
    private var screenId: String = ""
    private var deviceId: String = ""

    /**
     * Initialize and connect to the SignalR hub.
     */
    fun connect(serverUrl: String, screenId: String, deviceId: String) {
        this.serverUrl = serverUrl
        this.screenId = screenId
        this.deviceId = deviceId

        val url = "${serverUrl.trimEnd('/')}$HUB_PATH?clientType=player"

        hubConnection = HubConnectionBuilder.create(url).build().apply {
            // ── Register event handlers ──

            // PlaylistUpdated: backend sends a JSON object { screenId, slotNumber, action, timestamp }.
            // We receive as String and parse, because Java SignalR's `Any` may fail to
            // deserialize structured JSON. Matches Pi player's _on_playlist_updated().
            on("PlaylistUpdated", { raw: String ->
                Log.i(TAG, "PlaylistUpdated event received: $raw")
                try {
                    val json = JSONObject(raw)
                    val event = PlaylistUpdatedEvent(
                        action = json.optString("action", "Unknown"),
                        slotNumber = json.optInt("slotNumber", 0),
                        screenId = json.optString("screenId", "")
                    )
                    _playlistUpdated.tryEmit(event)
                } catch (e: Exception) {
                    // Fallback: emit with defaults if JSON parse fails
                    Log.w(TAG, "Failed to parse PlaylistUpdated payload, emitting default: ${e.message}")
                    _playlistUpdated.tryEmit(PlaylistUpdatedEvent())
                }
            }, String::class.java)

            on("SlotStatusChanged", { event: SlotStatusChangedEvent ->
                Log.i(TAG, "SlotStatusChanged: ${event.action} slot=${event.slotNumber}")
                _slotStatusChanged.tryEmit(event)
            }, SlotStatusChangedEvent::class.java)

            on("SetSyncMode", { mode: String ->
                Log.i(TAG, "SetSyncMode: $mode")
                _syncModeChanged.tryEmit(mode)
            }, String::class.java)

            on("ScreenStatusChanged", { _: Any? ->
                Log.d(TAG, "ScreenStatusChanged event received")
            }, Any::class.java)

            // ── Connection lifecycle ──
            onClosed { exception ->
                Log.w(TAG, "Connection closed: ${exception?.message}")
                scheduleReconnect()
            }
        }

        startConnection()
    }

    /**
     * Start the hub connection and register the device.
     */
    private fun startConnection() {
        scope.launch {
            try {
                hubConnection?.start()?.blockingAwait()
                Log.i(TAG, "Connected to SignalR hub")

                // Register device with the backend
                hubConnection?.invoke("RegisterDevice", screenId, deviceId)
                hubConnection?.invoke("SubscribeToScreen", screenId)
                Log.i(TAG, "Registered device $deviceId for screen $screenId")
            } catch (e: Exception) {
                Log.e(TAG, "Connection failed: ${e.message}")
                scheduleReconnect()
            }
        }
    }

    /**
     * Reconnect with exponential backoff: 5s → 10s → 20s → 40s → 60s (max).
     */
    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            var delay = INITIAL_RECONNECT_DELAY_MS
            while (isActive) {
                Log.i(TAG, "Reconnecting in ${delay}ms...")
                delay(delay)

                if (hubConnection?.connectionState == HubConnectionState.CONNECTED) {
                    break
                }

                try {
                    hubConnection?.start()?.blockingAwait()
                    Log.i(TAG, "Reconnected successfully")
                    hubConnection?.invoke("RegisterDevice", screenId, deviceId)
                    hubConnection?.invoke("SubscribeToScreen", screenId)
                    break
                } catch (e: Exception) {
                    Log.w(TAG, "Reconnect failed: ${e.message}")
                    delay = (delay * 2).coerceAtMost(MAX_RECONNECT_DELAY_MS)
                }
            }
        }
    }

    /**
     * Send AdStarted event for real-time dashboard updates.
     */
    fun sendAdStarted(event: AdPlaybackEvent) {
        if (hubConnection?.connectionState == HubConnectionState.CONNECTED) {
            scope.launch {
                try {
                    hubConnection?.invoke("AdStarted", event)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to send AdStarted: ${e.message}")
                }
            }
        }
    }

    /**
     * Send AdCompleted event for real-time dashboard updates + impression buffering.
     */
    fun sendAdCompleted(event: AdPlaybackEvent) {
        if (hubConnection?.connectionState == HubConnectionState.CONNECTED) {
            scope.launch {
                try {
                    hubConnection?.invoke("AdCompleted", event)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to send AdCompleted: ${e.message}")
                }
            }
        }
    }

    /**
     * Check if connected to the hub.
     */
    val isConnected: Boolean
        get() = hubConnection?.connectionState == HubConnectionState.CONNECTED

    /**
     * Disconnect and clean up.
     */
    fun disconnect() {
        reconnectJob?.cancel()
        try {
            hubConnection?.stop()?.blockingAwait()
        } catch (e: Exception) {
            Log.w(TAG, "Error disconnecting: ${e.message}")
        }
        hubConnection = null
    }

    /**
     * Clean up coroutine scope.
     */
    fun destroy() {
        disconnect()
        scope.cancel()
    }
}
