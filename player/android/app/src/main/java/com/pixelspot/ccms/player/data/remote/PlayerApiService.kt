package com.pixelspot.ccms.player.data.remote

import com.pixelspot.ccms.player.data.model.ApiResponse
import com.pixelspot.ccms.player.data.model.ClaimPairingCodeRequest
import com.pixelspot.ccms.player.data.model.ClaimPairingCodeResponse
import com.pixelspot.ccms.player.data.model.HandshakeRequest
import com.pixelspot.ccms.player.data.model.HandshakeResponse
import com.pixelspot.ccms.player.data.model.HeartbeatRequest
import com.pixelspot.ccms.player.data.model.HeartbeatResponse
import com.pixelspot.ccms.player.data.model.SyncRequest
import com.pixelspot.ccms.player.data.model.SyncResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * Retrofit interface for CCMS Player REST API.
 *
 * All endpoints are under /api/player/ and use HMAC-SHA256 signed headers
 * (injected via [com.pixelspot.ccms.player.security.SecurityManager] OkHttp interceptor).
 */
interface PlayerApiService {

    /**
     * Authenticate with the backend, receive playlist + session credentials.
     * Called once on startup and again when session expires (24h) or on SignalR reconnect.
     */
    @POST("api/v1/player/handshake")
    suspend fun handshake(@Body request: HandshakeRequest): Response<ApiResponse<HandshakeResponse>>

    /**
     * Batch sync pending impressions to the server.
     * Uses the "new flat format" with SlotPlayKey for server-side deduplication.
     *
     * Called every 1-10 minutes (adaptive via SetSyncMode SignalR event).
     */
    @POST("api/v1/player/sync")
    suspend fun syncImpressions(@Body request: SyncRequest): Response<SyncResponse>

    /**
     * Keep-alive heartbeat (every 30 seconds).
     * Updates LastSeenAt + IsOnline on the server.
     */
    @POST("api/v1/player/heartbeat")
    suspend fun heartbeat(@Body request: HeartbeatRequest): Response<HeartbeatResponse>

    /**
     * Anonymous pairing claim for CMS-mode screens. Player submits the
     * 6-character code the owner typed into the dashboard plus a device
     * fingerprint; server responds with the persistent screenId + apiKey
     * that the player then stores in SharedPreferences.
     */
    @POST("api/v1/cms/pairing/claim")
    suspend fun claimPairingCode(
        @Body request: ClaimPairingCodeRequest
    ): Response<ApiResponse<ClaimPairingCodeResponse>>
}
