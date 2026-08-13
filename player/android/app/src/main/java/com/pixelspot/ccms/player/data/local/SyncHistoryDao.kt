package com.pixelspot.ccms.player.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query

@Dao
interface SyncHistoryDao {

    @Insert
    suspend fun insert(entry: SyncHistoryEntity)

    @Query("SELECT * FROM sync_history ORDER BY id DESC LIMIT :limit")
    suspend fun getRecentHistory(limit: Int = 50): List<SyncHistoryEntity>

    @Query("DELETE FROM sync_history WHERE sync_time < :cutoffDate")
    suspend fun cleanupOld(cutoffDate: String): Int
}
