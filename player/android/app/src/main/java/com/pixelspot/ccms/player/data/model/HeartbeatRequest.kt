package com.pixelspot.ccms.player.data.model

import com.google.gson.annotations.SerializedName

/**
 * Heartbeat request sent to POST /api/player/heartbeat (every 30s)
 */
data class HeartbeatRequest(
    @SerializedName("screenId") val screenId: String
)

/**
 * Heartbeat response from POST /api/player/heartbeat
 */
data class HeartbeatResponse(
    @SerializedName("serverTime") val serverTime: String
)
