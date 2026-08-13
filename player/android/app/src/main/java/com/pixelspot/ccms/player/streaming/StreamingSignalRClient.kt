package com.pixelspot.ccms.player.streaming

import android.util.Log
import com.microsoft.signalr.HubConnection
import com.microsoft.signalr.HubConnectionBuilder
import com.microsoft.signalr.HubConnectionState
import com.microsoft.signalr.TransportEnum
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

/**
 * SignalR client for the /hubs/streaming endpoint.
 *
 * Separate from [com.pixelspot.ccms.player.data.remote.SignalRClient] which
 * handles /hubs/playback. This client manages WebRTC signaling:
 * - Registers this player as a stream source for a screen
 * - Receives viewer connection/disconnection events
 * - Relays SDP offers/answers and ICE candidates
 *
 * **Hub wire format**: The backend StreamingHub uses a JSON-blob convention
 * matching the Pi player and frontend — SDP and ICE data are packed into
 * single JSON strings (e.g., `{"type":"offer","sdp":"..."}`).
 * This client handles JSON pack/unpack at the boundary so the rest of
 * the Android code (WebRTCStreamer, PlayerService) uses typed fields.
 */
@Singleton
class StreamingSignalRClient @Inject constructor() {

    companion object {
        private const val TAG = "StreamingSignalR"
        private const val INITIAL_RECONNECT_DELAY_MS = 5_000L
        private const val MAX_RECONNECT_DELAY_MS = 60_000L
    }

    private var connection: HubConnection? = null
    private var screenId: String = ""
    private var serverUrl: String = ""
    private var apiKey: String = ""
    private var reconnectThread: Thread? = null
    @Volatile private var shouldReconnect = false

    // ── Callbacks wired by PlayerService ──

    /** Called when a dashboard viewer requests to watch this stream. */
    var onViewerConnected: ((viewerId: String) -> Unit)? = null

    /** Called when a viewer sends their SDP answer (decomposed from JSON blob). */
    var onAnswer: ((viewerId: String, sdpType: String, sdpContent: String) -> Unit)? = null

    /** Called when a viewer sends an ICE candidate (decomposed from JSON blob). */
    var onViewerIceCandidate: ((viewerId: String, candidate: String, sdpMid: String, sdpMLineIndex: Int) -> Unit)? = null

    /** Called when a viewer disconnects. */
    var onViewerDisconnected: ((viewerId: String) -> Unit)? = null

    /**
     * Connect to the streaming hub and register as a stream source.
     *
     * Hub signature: `RegisterStream(string screenId, string streamKey)`
     * Pi player passes apiKey as streamKey — we do the same.
     *
     * @param serverUrl Base server URL (e.g., "https://ccms.pixelspot.in")
     * @param screenId Screen ID to register for
     * @param apiKey API key used as streamKey for hub registration
     */
    fun connect(serverUrl: String, screenId: String, apiKey: String) {
        this.screenId = screenId
        this.serverUrl = serverUrl
        this.apiKey = apiKey
        this.shouldReconnect = true

        Log.i(TAG, "Creating connection to $serverUrl/hubs/streaming")

        connection = HubConnectionBuilder.create("$serverUrl/hubs/streaming")
            .withTransport(TransportEnum.WEBSOCKETS)
            .withHandshakeResponseTimeout(30_000)
            .build()

        setupEventHandlers()

        // Reconnect on close — matches playback SignalRClient's exponential backoff
        connection?.onClosed { exception ->
            Log.w(TAG, "Streaming connection closed: ${exception?.message}")
            if (shouldReconnect) scheduleReconnect()
        }

        try {
            Log.i(TAG, "Starting connection...")
            connection?.start()?.blockingAwait()
            Log.i(TAG, "Connection started, registering stream...")
            // Hub expects 2 params: (screenId, streamKey) — Pi passes apiKey as streamKey
            connection?.invoke("RegisterStream", screenId, apiKey)
            Log.i(TAG, "Connected and registered stream for screen $screenId")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to connect to streaming hub: ${e.message}", e)
            Log.e(TAG, "Streaming hub error details: ${e.cause?.message}")
            if (shouldReconnect) scheduleReconnect()
        }
    }

    /**
     * Reconnect with exponential backoff: 5s → 10s → 20s → 40s → 60s (max).
     * Re-registers the stream on success. Matches playback hub's reconnect pattern.
     */
    private fun scheduleReconnect() {
        reconnectThread?.interrupt()
        reconnectThread = Thread {
            var delay = INITIAL_RECONNECT_DELAY_MS
            while (shouldReconnect && !Thread.currentThread().isInterrupted) {
                Log.i(TAG, "Streaming hub reconnecting in ${delay}ms...")
                try { Thread.sleep(delay) } catch (_: InterruptedException) { return@Thread }

                if (connection?.connectionState == HubConnectionState.CONNECTED) break

                try {
                    connection?.start()?.blockingAwait()
                    Log.i(TAG, "Streaming hub reconnected, re-registering stream...")
                    connection?.invoke("RegisterStream", screenId, apiKey)
                    Log.i(TAG, "Stream re-registered for screen $screenId")
                    break
                } catch (e: Exception) {
                    Log.w(TAG, "Streaming hub reconnect failed: ${e.message}")
                    delay = (delay * 2).coerceAtMost(MAX_RECONNECT_DELAY_MS)
                }
            }
        }.also { it.isDaemon = true; it.start() }
    }

    private fun setupEventHandlers() {
        val conn = connection ?: return

        // OnViewerConnected(viewerId) — 1 param
        conn.on("OnViewerConnected", { viewerId: String ->
            Log.i(TAG, "Viewer connected: $viewerId")
            onViewerConnected?.invoke(viewerId)
        }, String::class.java)

        // OnAnswer(viewerId, answerSdpJson) — 2 params from hub
        // answerSdpJson is a JSON blob: {"type":"answer","sdp":"..."}
        // We decompose it into (viewerId, type, sdp) for WebRTCStreamer
        conn.on("OnAnswer", { viewerId: String, answerSdpJson: String ->
            Log.i(TAG, "Answer from viewer: $viewerId")
            try {
                val json = JSONObject(answerSdpJson)
                val sdpType = json.optString("type", "answer")
                val sdpContent = json.optString("sdp", "")
                onAnswer?.invoke(viewerId, sdpType, sdpContent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to parse answer SDP JSON: ${e.message}")
            }
        }, String::class.java, String::class.java)

        // OnViewerIceCandidate(viewerId, candidateJson) — 2 params from hub
        // candidateJson is a JSON blob: {"candidate":"...","sdpMid":"...","sdpMLineIndex":0}
        // We decompose it into (viewerId, candidate, sdpMid, sdpMLineIndex) for WebRTCStreamer
        conn.on("OnViewerIceCandidate", { viewerId: String, candidateJson: String ->
            Log.d(TAG, "ICE candidate from viewer: $viewerId")
            try {
                val json = JSONObject(candidateJson)
                val candidate = json.optString("candidate", "")
                val sdpMid = json.optString("sdpMid", "")
                val sdpMLineIndex = json.optInt("sdpMLineIndex", 0)
                onViewerIceCandidate?.invoke(viewerId, candidate, sdpMid, sdpMLineIndex)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to parse ICE candidate JSON: ${e.message}")
            }
        }, String::class.java, String::class.java)

        conn.on("OnViewerDisconnected", { viewerId: String ->
            Log.i(TAG, "Viewer disconnected: $viewerId")
            onViewerDisconnected?.invoke(viewerId)
        }, String::class.java)
    }

    /**
     * Send SDP offer to a specific viewer via the hub.
     *
     * Hub signature: `SendOffer(string viewerId, string offerSdp)` — 2 params.
     * We pack (sdpType, sdpContent) into a JSON blob matching frontend's format:
     * `{"type":"offer","sdp":"..."}`
     */
    fun sendOffer(viewerId: String, sdpType: String, sdpContent: String) {
        try {
            val offerJson = JSONObject().apply {
                put("type", sdpType)
                put("sdp", sdpContent)
            }.toString()
            connection?.invoke("SendOffer", viewerId, offerJson)
            Log.d(TAG, "Sent offer to viewer $viewerId")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send offer: ${e.message}", e)
        }
    }

    /**
     * Send ICE candidate to a specific viewer via the hub.
     *
     * Hub signature: `SendIceCandidate(string viewerId, string candidate)` — 2 params.
     * We pack (candidate, sdpMid, sdpMLineIndex) into a JSON blob matching frontend's format:
     * `{"candidate":"...","sdpMid":"...","sdpMLineIndex":0}`
     */
    fun sendIceCandidate(viewerId: String, candidate: String, sdpMid: String, sdpMLineIndex: Int) {
        try {
            val candidateJson = JSONObject().apply {
                put("candidate", candidate)
                put("sdpMid", sdpMid)
                put("sdpMLineIndex", sdpMLineIndex)
            }.toString()
            connection?.invoke("SendIceCandidate", viewerId, candidateJson)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send ICE candidate: ${e.message}", e)
        }
    }

    /** Whether connected to the streaming hub. */
    val isConnected: Boolean
        get() = connection?.connectionState == HubConnectionState.CONNECTED

    /** Disconnect from streaming hub and release resources. Cancels reconnect. */
    fun disconnect() {
        shouldReconnect = false
        reconnectThread?.interrupt()
        reconnectThread = null
        try { connection?.stop()?.blockingAwait() } catch (_: Exception) {}
        connection = null
        Log.i(TAG, "Disconnected from streaming hub")
    }
}
