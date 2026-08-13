package com.pixelspot.ccms.player.data.model

import com.google.gson.annotations.SerializedName

/**
 * Sync request sent to POST /api/player/sync
 * Uses the "new flat format" with SlotPlayKey for deduplication.
 */
data class SyncRequest(
    @SerializedName("screenId") val screenId: String,
    @SerializedName("syncData") val syncData: SyncData
)

data class SyncData(
    @SerializedName("impressions") val impressions: List<ImpressionPayload>
)

data class ImpressionPayload(
    @SerializedName("slotPlayKey") val slotPlayKey: String,
    @SerializedName("impressionId") val impressionId: String,
    @SerializedName("bookingId") val bookingId: String?,
    @SerializedName("campaignId") val campaignId: String?,
    @SerializedName("creativeId") val creativeId: String?,
    @SerializedName("ownerContentId") val ownerContentId: String?,
    @SerializedName("slotNumber") val slotNumber: Int,
    @SerializedName("playedAt") val playedAt: String,
    @SerializedName("verificationHash") val verificationHash: String,
    @SerializedName("durationSeconds") val durationSeconds: Int,
    @SerializedName("expectedDurationSeconds") val expectedDurationSeconds: Int,
    @SerializedName("wasFullPlay") val wasFullPlay: Boolean
)

/**
 * Sync response from POST /api/player/sync
 */
data class SyncResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("impressionsSaved") val impressionsSaved: Int,
    @SerializedName("duplicatesSkipped") val duplicatesSkipped: Int,
    @SerializedName("message") val message: String?
)
