package com.pixelspot.ccms.player.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

/**
 * Room DAO for impressions — implements SlotPlayKey deduplication.
 *
 * [OnConflictStrategy.IGNORE] on insert means duplicate slot_play_key records
 * are silently skipped (same behavior as Pi's IntegrityError catch).
 */
@Dao
interface ImpressionDao {

    /**
     * Record a new impression. Duplicates (same slot_play_key) are ignored.
     * Returns the rowId if inserted, -1 if ignored (duplicate).
     */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertOrIgnore(impression: ImpressionEntity): Long

    /**
     * Get pending (unsynced) impressions, ordered by creation time.
     * Limits batch size to prevent huge payloads.
     */
    @Query("SELECT * FROM impressions WHERE synced = 0 ORDER BY created_at ASC LIMIT :limit")
    suspend fun getPendingImpressions(limit: Int = 500): List<ImpressionEntity>

    /**
     * Mark impressions as synced after successful server upload.
     */
    @Query(
        """UPDATE impressions 
           SET synced = 1, server_confirmed = :serverConfirmed, last_sync_attempt = :syncTime 
           WHERE impression_id IN (:impressionIds)"""
    )
    suspend fun markSynced(impressionIds: List<String>, serverConfirmed: Boolean, syncTime: String)

    /**
     * Increment sync attempt counter for failed syncs.
     */
    @Query(
        """UPDATE impressions 
           SET sync_attempts = sync_attempts + 1, last_sync_attempt = :syncTime 
           WHERE impression_id IN (:impressionIds)"""
    )
    suspend fun incrementSyncAttempts(impressionIds: List<String>, syncTime: String)

    /**
     * Count all impressions.
     */
    @Query("SELECT COUNT(*) FROM impressions")
    suspend fun getTotalCount(): Int

    /**
     * Count pending (unsynced) impressions.
     */
    @Query("SELECT COUNT(*) FROM impressions WHERE synced = 0")
    suspend fun getPendingCount(): Int

    /**
     * Count impressions recorded today (UTC).
     */
    @Query("SELECT COUNT(*) FROM impressions WHERE played_at LIKE :todayPrefix || '%'")
    suspend fun getTodayCount(todayPrefix: String): Int

    /**
     * Clean up old synced + confirmed impressions (retention policy).
     * Same as Pi's _cleanup_old_synced(days=7).
     */
    @Query(
        """DELETE FROM impressions 
           WHERE synced = 1 AND server_confirmed = 1 AND created_at < :cutoffDate"""
    )
    suspend fun cleanupOldSynced(cutoffDate: String): Int

    /**
     * Check if a specific slot_play_key already exists (for pre-insert dedup check).
     */
    @Query("SELECT COUNT(*) FROM impressions WHERE slot_play_key = :slotPlayKey")
    suspend fun existsBySlotPlayKey(slotPlayKey: String): Int
}
