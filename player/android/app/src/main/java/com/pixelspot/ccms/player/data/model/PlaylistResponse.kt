package com.pixelspot.ccms.player.data.model

import com.google.gson.annotations.SerializedName

/**
 * Playlist envelope returned inside HandshakeResponse.playlist.
 *
 * Maps exactly to backend's PlaylistResponse (camelCase JSON):
 *   screenId, screenName, date, operatingStart, operatingEnd,
 *   timeFrameMinutes, slotsPerFrame, playlist (array of items),
 *   totalSlots, bookedSlots, fillerSlots
 *
 * Note: the backend field is called "playlist" for both the outer
 * (HandshakeResponse.Playlist → PlaylistResponse) and inner
 * (PlaylistResponse.Playlist → List<PlaylistItemResponse>) levels.
 * We use @SerializedName to map the inner JSON key "playlist" to [items].
 */
data class PlaylistResponse(
    @SerializedName("screenId") val screenId: String?,
    @SerializedName("screenName") val screenName: String?,
    @SerializedName("date") val date: String?,
    @SerializedName("operatingStart") val operatingStart: String?,
    @SerializedName("operatingEnd") val operatingEnd: String?,
    @SerializedName("timeFrameMinutes") val timeFrameMinutes: Int?,
    @SerializedName("slotsPerFrame") val slotsPerFrame: Int?,
    @SerializedName("playlist") val items: List<PlaylistItem>,
    @SerializedName("totalSlots") val totalSlots: Int?,
    @SerializedName("bookedSlots") val bookedSlots: Int?,
    @SerializedName("fillerSlots") val fillerSlots: Int?
)
