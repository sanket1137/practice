package com.pixelspot.ccms.player.data.model

import com.google.gson.annotations.SerializedName

/**
 * Request body for POST /api/v1/pairing/claim.
 * Player submits the 6-character code the owner showed on the dashboard
 * plus a unique device id. Server responds with a permanent API key.
 */
data class ClaimPairingCodeRequest(
    @SerializedName("code") val code: String,
    @SerializedName("deviceFingerprint") val deviceFingerprint: String,
    @SerializedName("deviceModel") val deviceModel: String? = null,
    @SerializedName("osVersion") val osVersion: String? = null,
    @SerializedName("appVersion") val appVersion: String? = null
)

/**
 * Response from a successful pairing claim. Contains the persistent
 * credentials the player saves to [com.pixelspot.ccms.player.config.PlayerConfig].
 */
data class ClaimPairingCodeResponse(
    @SerializedName("screenId") val screenId: String,
    @SerializedName("apiKey") val apiKey: String,
    @SerializedName("screenName") val screenName: String?
)
