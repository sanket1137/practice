package com.pixelspot.ccms.player.data.model

import com.google.gson.annotations.SerializedName

/**
 * A single item in the playlist returned by handshake.
 *
 * Maps exactly to backend's PlaylistItemResponse (camelCase JSON):
 *   startTime, endTime, slotNumber, bookingId, campaignId, creativeId,
 *   creativeUrl, creativeMimeType, durationSeconds, impressionId,
 *   isFillerContent, ownerContentId
 *
 * @see com.pixelspot.ccms.player.data.model.PlaylistResponse
 */
data class PlaylistItem(
    @SerializedName("slotNumber") val slotNumber: Int,
    @SerializedName("bookingId") val bookingId: String?,
    @SerializedName("campaignId") val campaignId: String?,
    @SerializedName("creativeId") val creativeId: String?,
    @SerializedName("ownerContentId") val ownerContentId: String?,
    @SerializedName("creativeUrl") val creativeUrl: String?,
    @SerializedName("creativeMimeType") val creativeMimeType: String?,
    @SerializedName("durationSeconds") val durationSeconds: Int,
    @SerializedName("isFillerContent") val isFillerContent: Boolean,
    @SerializedName("startTime") val startTime: String?,
    @SerializedName("endTime") val endTime: String?,
    @SerializedName("impressionId") val impressionId: String?
) {
    /** Video URL for ExoPlayer (delegates to backend's creativeUrl field). */
    val videoUrl: String get() = creativeUrl ?: ""

    /** Whether this slot is owner custom content (not a booking or filler). */
    val isOwnerContent: Boolean get() = ownerContentId != null

    /** Whether this slot is a default/fallback video (no real booking). */
    val isDefault: Boolean get() = isFillerContent

    /** Whether this slot has real paid or owner content (not filler). */
    val hasContent: Boolean get() = !isFillerContent && !creativeUrl.isNullOrBlank()
}
