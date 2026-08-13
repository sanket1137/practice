package com.pixelspot.ccms.player.data.remote

import android.util.Log
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.microsoft.signalr.HubConnection
import com.microsoft.signalr.HubConnectionBuilder
import com.microsoft.signalr.HubConnectionState
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * SignalR client for the CMS control hub at /hubs/cms.
 *
 * Authenticates via player API key (BCrypt-verified server-side in
 * `CmsControlHub.SubscribePlayer`). Once subscribed, the hub pushes two
 * event types to this device:
 *   - "command"          — a [RemoteCommandPayload] from the dashboard
 *   - "playlist_updated" — a JSON blob {screenId, playlistId, version?, defaultChanged?}
 *
 * Command execution is delegated to the caller via [onCommand]; after running
 * the command the caller must invoke [ackCommand] to close the loop.
 */
@Singleton
class CmsControlHubClient @Inject constructor(
    private val gson: Gson
) {
    companion object {
        private const val TAG = "CmsControlHubClient"
        private const val HUB_PATH = "/hubs/cms"
        private const val INITIAL_BACKOFF_MS = 5_000L
        private const val MAX_BACKOFF_MS = 60_000L
    }

    private var hub: HubConnection? = null
    private var reconnectJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private var serverUrl: String = ""
    private var screenId: String = ""
    private var apiKey: String = ""

    private val _commandReceived = MutableSharedFlow<RemoteCommandPayload>(extraBufferCapacity = 8)
    val commandReceived: SharedFlow<RemoteCommandPayload> = _commandReceived

    private val _playlistUpdated = MutableSharedFlow<PlaylistUpdatedPayload>(extraBufferCapacity = 2)
    val playlistUpdated: SharedFlow<PlaylistUpdatedPayload> = _playlistUpdated

    /** Connect and subscribe this player to the CMS hub group for [screenId]. */
    fun connect(serverUrl: String, screenId: String, apiKey: String) {
        this.serverUrl = serverUrl
        this.screenId = screenId
        this.apiKey = apiKey

        val url = "${serverUrl.trimEnd('/')}$HUB_PATH?access_token=${apiKey}"
        hub = HubConnectionBuilder.create(url).build().apply {
            on("command", { raw: String ->
                Log.i(TAG, "command received: $raw")
                runCatching { gson.fromJson(raw, RemoteCommandPayload::class.java) }
                    .onSuccess { _commandReceived.tryEmit(it) }
                    .onFailure { Log.w(TAG, "Failed to parse command: ${it.message}") }
            }, String::class.java)

            on("playlist_updated", { raw: String ->
                Log.i(TAG, "playlist_updated: $raw")
                runCatching { gson.fromJson(raw, PlaylistUpdatedPayload::class.java) }
                    .onSuccess { _playlistUpdated.tryEmit(it) }
                    .onFailure { Log.w(TAG, "Failed to parse playlist_updated: ${it.message}") }
            }, String::class.java)

            on("player_online", { _: Any? -> Log.d(TAG, "player_online broadcast received") }, Any::class.java)
            on("player_offline", { _: Any? -> Log.d(TAG, "player_offline broadcast received") }, Any::class.java)
            on("command_ack", { _: Any? -> Log.d(TAG, "command_ack broadcast received") }, Any::class.java)

            onClosed { ex ->
                Log.w(TAG, "Connection closed: ${ex?.message}")
                scheduleReconnect()
            }
        }

        startConnection()
    }

    private fun startConnection() {
        scope.launch {
            try {
                hub?.start()?.blockingAwait()
                Log.i(TAG, "Connected to $HUB_PATH")
                hub?.invoke("SubscribePlayer", screenId, apiKey)?.blockingAwait()
                Log.i(TAG, "SubscribePlayer succeeded for screen $screenId")
            } catch (e: Exception) {
                Log.e(TAG, "Connect failed: ${e.message}")
                scheduleReconnect()
            }
        }
    }

    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            var delay = INITIAL_BACKOFF_MS
            while (isActive) {
                delay(delay)
                if (hub?.connectionState == HubConnectionState.CONNECTED) break
                try {
                    hub?.start()?.blockingAwait()
                    hub?.invoke("SubscribePlayer", screenId, apiKey)?.blockingAwait()
                    Log.i(TAG, "Reconnected")
                    break
                } catch (e: Exception) {
                    Log.w(TAG, "Reconnect failed: ${e.message}")
                    delay = (delay * 2).coerceAtMost(MAX_BACKOFF_MS)
                }
            }
        }
    }

    /** Acknowledge a command so the dashboard sees Acked/Failed status. */
    fun ackCommand(commandId: String, success: Boolean, errorMessage: String? = null) {
        if (hub?.connectionState != HubConnectionState.CONNECTED) {
            Log.w(TAG, "ackCommand skipped — not connected")
            return
        }
        scope.launch {
            try {
                val req = AckCommandRequest(commandId, success, errorMessage)
                hub?.invoke("AckCommand", req)?.blockingAwait()
            } catch (e: Exception) {
                Log.w(TAG, "AckCommand failed: ${e.message}")
            }
        }
    }

    fun disconnect() {
        reconnectJob?.cancel()
        runCatching { hub?.stop()?.blockingAwait() }
        hub = null
    }

    // ── Wire types ──

    data class RemoteCommandPayload(
        @SerializedName("id") val id: String,
        @SerializedName("screenId") val screenId: String,
        @SerializedName("commandType") val commandType: String,
        @SerializedName("payloadJson") val payloadJson: String?,
        @SerializedName("status") val status: String,
        @SerializedName("issuedAt") val issuedAt: String?
    )

    data class PlaylistUpdatedPayload(
        @SerializedName("screenId") val screenId: String?,
        @SerializedName("playlistId") val playlistId: String?,
        @SerializedName("version") val version: Int?,
        @SerializedName("defaultChanged") val defaultChanged: Boolean?
    )

    private data class AckCommandRequest(
        @SerializedName("CommandId") val commandId: String,
        @SerializedName("Success") val success: Boolean,
        @SerializedName("ErrorMessage") val errorMessage: String?
    )
}
