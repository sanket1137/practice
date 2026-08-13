package com.pixelspot.ccms.player.data.repository

import android.util.Log
import com.pixelspot.ccms.player.config.PlayerConfig
import com.pixelspot.ccms.player.data.model.*
import com.pixelspot.ccms.player.data.remote.PlayerApiService
import com.pixelspot.ccms.player.security.SecurityManager
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Orchestrates player-server communication.
 *
 * Handles handshake (authentication + playlist), heartbeat (keep-alive),
 * and impression sync, with proper error handling and session management.
 */
@Singleton
class PlayerRepository @Inject constructor(
    private val apiService: PlayerApiService,
    private val securityManager: SecurityManager,
    private val impressionRepository: ImpressionRepository,
    private val playerConfig: PlayerConfig
) {

    companion object {
        private const val TAG = "PlayerRepo"
        private const val PLAYER_VERSION = "1.0.0-android"
    }

    // ── Current session state ──
    private var currentPlaylist: List<PlaylistItem> = emptyList()
    private var operatingHours: Map<String, String>? = null
    private var screenTimezone: String = "Asia/Kolkata"

    /**
     * Perform handshake with the backend.
     * Returns the HandshakeResponse on success, null on failure.
     *
     * Populates [currentPlaylist] from the nested PlaylistResponse
     * so callers can immediately call [getPlaylist] after a successful handshake.
     */
    suspend fun handshake(): HandshakeResponse? {
        val screenId = playerConfig.screenId ?: return null
        val apiKey = playerConfig.apiKey ?: return null

        val fingerprint = securityManager.getDeviceFingerprint()
        val nonce = securityManager.generateNonce()

        val request = HandshakeRequest(
            screenId = screenId,
            apiKey = apiKey,
            apiKeyHash = securityManager.hashApiKey(apiKey),
            deviceFingerprint = fingerprint,
            nonce = nonce,
            timestamp = System.currentTimeMillis() / 1000,
            playerVersion = PLAYER_VERSION
        )

        return try {
            val response = apiService.handshake(request)
            if (response.isSuccessful && response.body()?.success == true) {
                val apiResp = response.body()!!
                val data = apiResp.data ?: return null

                // Update session credentials
                securityManager.processHandshakeResponse(
                    sessionToken = data.sessionToken ?: "",
                    serverSalt = data.serverSalt ?: "",
                    expiresAt = data.sessionExpiresAt ?: ""
                )

                // Extract playlist items from the nested PlaylistResponse
                val playlistResp = data.playlist
                Log.d(TAG, "Playlist response: screenId=${playlistResp?.screenId}, " +
                        "totalSlots=${playlistResp?.totalSlots}, " +
                        "itemsCount=${playlistResp?.items?.size ?: 0}")

                currentPlaylist = playlistResp?.items ?: emptyList()

                // Log each playlist item for debugging
                currentPlaylist.forEachIndexed { index, item ->
                    Log.d(TAG, "Playlist[$index]: url=${item.creativeUrl}, " +
                            "duration=${item.durationSeconds}s, " +
                            "isFiller=${item.isFillerContent}")
                }

                // Cache config
                operatingHours = data.operatingHours
                screenTimezone = data.screenTimezone ?: "Asia/Kolkata"

                Log.i(TAG, "Handshake OK: device=${data.deviceBindingStatus}, " +
                        "sync=${data.syncIntervalMinutes}min, " +
                        "playlist=${currentPlaylist.size} items")
                data
            } else {
                Log.e(TAG, "Handshake failed: ${response.code()} ${response.errorBody()?.string()}")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Handshake error: ${e.message}", e)
            null
        }
    }

    /**
     * Send heartbeat to keep the screen marked as online.
     */
    suspend fun sendHeartbeat(): Boolean {
        val screenId = playerConfig.screenId ?: return false

        return try {
            val response = apiService.heartbeat(HeartbeatRequest(screenId))
            if (response.isSuccessful) {
                Log.d(TAG, "Heartbeat OK, server time: ${response.body()?.serverTime}")
                true
            } else {
                Log.w(TAG, "Heartbeat failed: ${response.code()}")
                false
            }
        } catch (e: Exception) {
            Log.w(TAG, "Heartbeat error: ${e.message}")
            false
        }
    }

    /**
     * Sync pending impressions to the server.
     *
     * @return Number of impressions confirmed by server, or -1 on failure.
     */
    suspend fun syncImpressions(): Int {
        val screenId = playerConfig.screenId ?: return -1
        val pending = impressionRepository.getPendingPayloads()

        if (pending.isEmpty()) {
            Log.d(TAG, "No pending impressions to sync")
            return 0
        }

        return try {
            val request = SyncRequest(
                screenId = screenId,
                syncData = SyncData(impressions = pending)
            )
            val response = apiService.syncImpressions(request)

            if (response.isSuccessful && response.body()?.success == true) {
                val body = response.body()!!
                val impressionIds = pending.map { it.impressionId }
                impressionRepository.markSynced(impressionIds, serverConfirmed = true)
                impressionRepository.logSyncHistory(
                    impressionsSent = pending.size,
                    impressionsConfirmed = body.impressionsSaved,
                    impressionsDuplicate = body.duplicatesSkipped,
                    serverResponse = body.message,
                    success = true
                )
                Log.i(TAG, "Sync OK: ${body.impressionsSaved} saved, ${body.duplicatesSkipped} dupes")
                body.impressionsSaved
            } else {
                val impressionIds = pending.map { it.impressionId }
                impressionRepository.incrementSyncAttempts(impressionIds)
                impressionRepository.logSyncHistory(
                    impressionsSent = pending.size,
                    impressionsConfirmed = 0,
                    impressionsDuplicate = 0,
                    serverResponse = response.errorBody()?.string(),
                    success = false
                )
                Log.w(TAG, "Sync failed: ${response.code()}")
                -1
            }
        } catch (e: Exception) {
            Log.e(TAG, "Sync error: ${e.message}", e)
            -1
        }
    }

    fun getPlaylist(): List<PlaylistItem> = currentPlaylist
    fun getOperatingHours(): Map<String, String>? = operatingHours
    fun getScreenTimezone(): String = screenTimezone
}
