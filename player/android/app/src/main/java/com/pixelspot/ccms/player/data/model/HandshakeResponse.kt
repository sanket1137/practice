package com.pixelspot.ccms.player.data.model

import com.google.gson.annotations.SerializedName

/**
 * Generic API response wrapper matching backend's ApiResponse<T>.
 */
data class ApiResponse<T>(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String?,
    @SerializedName("data") val data: T?,
    @SerializedName("errors") val errors: List<String>?
)

/**
 * Handshake response from POST /api/player/handshake
 * Contains everything the player needs to start operating.
 *
 * Maps to backend's HandshakeResponse which is wrapped in ApiResponse<HandshakeResponse>.
 *
 * The playlist field is a PlaylistResponse object containing the nested
 * items array — not a raw list.  See [PlaylistResponse] and [PlaylistItem].
 */
data class HandshakeResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String?,
    @SerializedName("serverTime") val serverTime: String?,
    @SerializedName("playlist") val playlist: PlaylistResponse?,
    @SerializedName("syncIntervalMinutes") val syncIntervalMinutes: Int,
    @SerializedName("screenTimezone") val screenTimezone: String?,
    @SerializedName("operatingHours") val operatingHours: Map<String, String>?,
    @SerializedName("sessionToken") val sessionToken: String?,
    @SerializedName("serverSalt") val serverSalt: String?,
    @SerializedName("sessionExpiresAt") val sessionExpiresAt: String?,
    @SerializedName("verificationSalt") val verificationSalt: String?,
    @SerializedName("deviceBindingStatus") val deviceBindingStatus: String?,
    @SerializedName("verificationMode") val verificationMode: Boolean = false,
    @SerializedName("verificationStatus") val verificationStatus: String? = null,
    @SerializedName("qrChallengeUrl") val qrChallengeUrl: String? = null
)
