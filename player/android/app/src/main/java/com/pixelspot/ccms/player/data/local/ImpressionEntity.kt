package com.pixelspot.ccms.player.data.local

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Local impression record — mirrors the Raspberry Pi's SQLite schema exactly.
 *
 * Deduplication via [slotPlayKey]: SHA256(screenId|date|slotNumber|YYYY-MM-DDTHH:MM:SS)
 * ensures the same slot cannot record more than one impression per second.
 */
@Entity(
    tableName = "impressions",
    indices = [
        Index(value = ["slot_play_key"], unique = true),
        Index(value = ["synced"]),
        Index(value = ["created_at"])
    ]
)
data class ImpressionEntity(
    @PrimaryKey
    @ColumnInfo(name = "impression_id") val impressionId: String,

    @ColumnInfo(name = "slot_play_key") val slotPlayKey: String,

    @ColumnInfo(name = "screen_id") val screenId: String,
    @ColumnInfo(name = "booking_id") val bookingId: String?,
    @ColumnInfo(name = "campaign_id") val campaignId: String?,
    @ColumnInfo(name = "creative_id") val creativeId: String?,
    @ColumnInfo(name = "owner_content_id") val ownerContentId: String?,

    @ColumnInfo(name = "slot_number") val slotNumber: Int,

    /** UTC ISO-8601 timestamp when the ad was played */
    @ColumnInfo(name = "played_at") val playedAt: String,

    /** Local timezone timestamp for display/debugging */
    @ColumnInfo(name = "played_at_local") val playedAtLocal: String?,

    @ColumnInfo(name = "duration_seconds") val durationSeconds: Int,
    @ColumnInfo(name = "expected_duration_seconds") val expectedDurationSeconds: Int,
    @ColumnInfo(name = "was_full_play") val wasFullPlay: Boolean,

    /** HMAC-SHA256 verification hash to prevent impression tampering */
    @ColumnInfo(name = "verification_hash") val verificationHash: String?,

    /** Whether this impression has been synced to the server */
    @ColumnInfo(name = "synced", defaultValue = "0") val synced: Boolean = false,

    @ColumnInfo(name = "sync_attempts", defaultValue = "0") val syncAttempts: Int = 0,
    @ColumnInfo(name = "last_sync_attempt") val lastSyncAttempt: String? = null,

    /** Server confirmed receipt of this impression */
    @ColumnInfo(name = "server_confirmed", defaultValue = "0") val serverConfirmed: Boolean = false,

    @ColumnInfo(name = "created_at") val createdAt: String
)
