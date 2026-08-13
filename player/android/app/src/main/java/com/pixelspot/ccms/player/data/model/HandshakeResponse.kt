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
    @SerializedName("qrChallengeUrl") val qrChallengeUrl: String? = null,
    // CMS-mode fields (populated only when screen owner's AccountType == CmsOwner)
    @SerializedName("cmsPlaylist") val cmsPlaylist: CmsPlaylistDto? = null,
    @SerializedName("screenMode") val screenMode: String? = null
)

/** Mirrors backend CmsPlaylistDto for player consumption. */
data class CmsPlaylistDto(
    @SerializedName("id") val id: String,
    @SerializedName("screenId") val screenId: String,
    @SerializedName("name") val name: String,
    @SerializedName("playlistType") val playlistType: String,
    @SerializedName("version") val version: Int,
    @SerializedName("isDefault") val isDefault: Boolean,
    @SerializedName("lastPublishedAt") val lastPublishedAt: String?,
    @SerializedName("items") val items: List<CmsPlaylistItemDto> = emptyList()
)

data class CmsPlaylistItemDto(
    @SerializedName("id") val id: String,
    @SerializedName("mediaAssetId") val mediaAssetId: String,
    @SerializedName("itemType") val itemType: String,
    @SerializedName("order") val order: Int,
    @SerializedName("durationSeconds") val durationSeconds: Int?,
    @SerializedName("mediaAsset") val mediaAsset: CmsMediaAssetDto?
)

data class CmsMediaAssetDto(
    @SerializedName("id") val id: String,
    @SerializedName("originalName") val originalName: String,
    @SerializedName("mimeType") val mimeType: String,
    @SerializedName("sizeBytes") val sizeBytes: Long,
    @SerializedName("fileUrl") val fileUrl: String,
    @SerializedName("thumbnailUrl") val thumbnailUrl: String?,
    @SerializedName("width") val width: Int?,
    @SerializedName("height") val height: Int?,
    @SerializedName("durationSeconds") val durationSeconds: Int?,
    @SerializedName("isReady") val isReady: Boolean
)
