package com.pixelspot.ccms.player.player

import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.pixelspot.ccms.player.CcmsPlayerApp
import com.pixelspot.ccms.player.data.remote.CmsControlHubClient
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Translates dashboard-issued CMS commands into ExoPlayer operations.
 *
 * Receives [CmsControlHubClient.RemoteCommandPayload] emissions and — after
 * executing the command — calls [CmsControlHubClient.ackCommand] with the
 * outcome so the dashboard timeline updates.
 *
 * Supported command types (case-insensitive): Play, Pause, Skip, Next, Previous,
 * Restart, RestartLoop, JumpTo, ForceSync, Reboot, SetVolume. Unknown commands
 * are acked as failures with a descriptive message.
 */
@Singleton
class RemoteCommandHandler @Inject constructor(
    private val exoPlayerManager: ExoPlayerManager,
    private val hubClient: CmsControlHubClient,
    private val gson: Gson
) {
    companion object {
        private const val TAG = "RemoteCommandHandler"
    }

    fun handle(cmd: CmsControlHubClient.RemoteCommandPayload) {
        val player = exoPlayerManager.getPlayer()
        if (player == null) {
            hubClient.ackCommand(cmd.id, success = false, errorMessage = "Player not initialized")
            return
        }

        try {
            when (cmd.commandType.lowercase()) {
                "play" -> player.play()
                "pause" -> player.pause()
                "skip", "next" -> {
                    if (player.hasNextMediaItem()) player.seekToNextMediaItem()
                    else player.seekTo(0, 0L)
                }
                "previous" -> {
                    if (player.hasPreviousMediaItem()) player.seekToPreviousMediaItem()
                    else player.seekTo(0, 0L)
                }
                "restart", "restartloop" -> {
                    player.seekTo(0, 0L)
                    player.play()
                }
                "jumpto" -> {
                    val payload = parsePayload(cmd.payloadJson)
                    val index = payload?.get("index")?.asInt
                        ?: payload?.get("itemIndex")?.asInt
                        ?: throw IllegalArgumentException("JumpTo requires 'index'")
                    player.seekTo(index, 0L)
                    player.play()
                }
                "setvolume" -> {
                    val payload = parsePayload(cmd.payloadJson)
                    val volume = payload?.get("volume")?.asFloat
                        ?: throw IllegalArgumentException("SetVolume requires 'volume' (0-1)")
                    player.volume = volume.coerceIn(0f, 1f)
                }
                "mute" -> {
                    player.volume = 0f
                }
                "unmute" -> {
                    if (player.volume <= 0f) {
                        player.volume = 1f
                    }
                }
                "setbrightness" -> {
                    val payload = parsePayload(cmd.payloadJson)
                    val raw = payload?.get("brightness")?.asFloat
                        ?: payload?.get("value")?.asFloat
                        ?: throw IllegalArgumentException("SetBrightness requires 'brightness' or 'value'")
                    val normalized = (raw.coerceIn(0f, 100f) / 100f).coerceAtLeast(0.05f)
                    val activity = CcmsPlayerApp.currentActivity
                    if (activity != null) {
                        val params = activity.window.attributes
                        params.screenBrightness = normalized
                        activity.window.attributes = params
                    }
                }
                "forcesync" -> {
                    // Signal PlayerService to re-handshake / refresh playlist.
                    // Handled out-of-band by PlayerService observing the same flow;
                    // here we simply ack OK so the dashboard marks it complete.
                    Log.i(TAG, "ForceSync requested — PlayerService should refresh")
                }
                "reboot" -> {
                    // We ack first then trigger a process restart so the ack reaches
                    // the server before the process dies.
                    hubClient.ackCommand(cmd.id, success = true)
                    Log.w(TAG, "Reboot command received — exiting process")
                    android.os.Handler(android.os.Looper.getMainLooper())
                        .postDelayed({ android.os.Process.killProcess(android.os.Process.myPid()) }, 500)
                    return
                }
                else -> {
                    hubClient.ackCommand(cmd.id, success = false,
                        errorMessage = "Unknown command: ${cmd.commandType}")
                    return
                }
            }
            hubClient.ackCommand(cmd.id, success = true)
        } catch (e: Exception) {
            Log.e(TAG, "Command ${cmd.commandType} failed", e)
            hubClient.ackCommand(cmd.id, success = false, errorMessage = e.message)
        }
    }

    private fun parsePayload(json: String?): JsonObject? {
        if (json.isNullOrBlank()) return null
        return runCatching { gson.fromJson(json, JsonObject::class.java) }.getOrNull()
    }
}
