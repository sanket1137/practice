package com.pixelspot.ccms.player.data.model

import com.google.gson.annotations.SerializedName

/**
 * Handshake request sent to POST /api/player/handshake
 * Authenticates the player and retrieves playlist + session credentials.
 */
data class HandshakeRequest(
    @SerializedName("screenId") val screenId: String,
    @SerializedName("apiKey") val apiKey: String,
    @SerializedName("apiKeyHash") val apiKeyHash: String?,
    @SerializedName("deviceFingerprint") val deviceFingerprint: String?,
    @SerializedName("nonce") val nonce: String?,
    @SerializedName("timestamp") val timestamp: Long?,
    @SerializedName("playerVersion") val playerVersion: String
)
