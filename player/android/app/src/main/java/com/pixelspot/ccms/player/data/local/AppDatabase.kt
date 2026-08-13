package com.pixelspot.ccms.player.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

/**
 * Room database for local impression storage.
 *
 * Mirrors the Raspberry Pi's SQLite schema with the same tables:
 * - impressions: ad play records with SlotPlayKey deduplication
 * - sync_history: sync attempt log for debugging
 */
@Database(
    entities = [ImpressionEntity::class, SyncHistoryEntity::class],
    version = 1,
    exportSchema = true
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun impressionDao(): ImpressionDao
    abstract fun syncHistoryDao(): SyncHistoryDao

    companion object {
        const val DATABASE_NAME = "ccms_impressions.db"
    }
}
