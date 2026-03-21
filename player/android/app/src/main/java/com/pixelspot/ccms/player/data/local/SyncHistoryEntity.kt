package com.pixelspot.ccms.player.data.local

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Tracks sync history for debugging and analytics.
 * Mirrors the Pi's sync_history table.
 */
@Entity(tableName = "sync_history")
data class SyncHistoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "sync_time") val syncTime: String,
    @ColumnInfo(name = "impressions_sent") val impressionsSent: Int,
    @ColumnInfo(name = "impressions_confirmed") val impressionsConfirmed: Int,
    @ColumnInfo(name = "impressions_duplicate") val impressionsDuplicate: Int,
    @ColumnInfo(name = "server_response") val serverResponse: String?,
    @ColumnInfo(name = "success") val success: Boolean
)
