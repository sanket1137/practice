package com.pixelspot.ccms.player.data.model

import com.google.gson.annotations.SerializedName

/**
 * Real-time ad playback event sent via SignalR (AdStarted / AdCompleted).
 * Broadcasted to screen + campaign groups for live dashboard updates.
 */
data class AdPlaybackEvent(
    @SerializedName("screenId") val screenId: String,
    @SerializedName("bookingId") val bookingId: String?,
    @SerializedName("campaignId") val campaignId: String?,
    @SerializedName("creativeId") val creativeId: String?,
    @SerializedName("ownerContentId") val ownerContentId: String?,
    @SerializedName("slotNumber") val slotNumber: Int,
    @SerializedName("playedAt") val playedAt: String,
    @SerializedName("impressionId") val impressionId: String,
    @SerializedName("slotPlayKey") val slotPlayKey: String,
    @SerializedName("durationSeconds") val durationSeconds: Int?,
    @SerializedName("wasFullPlay") val wasFullPlay: Boolean?
)

/**
 * SlotStatusChanged event received via SignalR when bookings or content change.
 */
data class SlotStatusChangedEvent(
    @SerializedName("screenId") val screenId: String,
    @SerializedName("slotNumber") val slotNumber: Int?,
    @SerializedName("action") val action: String,   // BookingActivated, BookingCompleted, OwnerContentAdded, OwnerContentRemoved
    @SerializedName("bookingId") val bookingId: String?,
    @SerializedName("campaignId") val campaignId: String?
)
