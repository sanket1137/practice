package com.pixelspot.ccms.player.data.repository

import android.util.Log
import com.pixelspot.ccms.player.data.local.ImpressionDao
import com.pixelspot.ccms.player.data.local.ImpressionEntity
import com.pixelspot.ccms.player.data.local.SyncHistoryDao
import com.pixelspot.ccms.player.data.local.SyncHistoryEntity
import com.pixelspot.ccms.player.data.model.ImpressionPayload
import com.pixelspot.ccms.player.data.model.PlaylistItem
import com.pixelspot.ccms.player.security.ImpressionVerifier
import com.pixelspot.ccms.player.security.SecurityManager
import java.security.MessageDigest
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages impression recording and retrieval.
 *
 * Implements the same SlotPlayKey deduplication as the Pi player:
 * SHA256(screenId|date|slotNumber|YYYY-MM-DDTHH:MM:SS) — second-level precision
 * ensures the same slot cannot record more than once per second.
 */
@Singleton
class ImpressionRepository @Inject constructor(
    private val impressionDao: ImpressionDao,
    private val syncHistoryDao: SyncHistoryDao,
    private val impressionVerifier: ImpressionVerifier
) {

    companion object {
        private const val TAG = "ImpressionRepo"
        private const val CLEANUP_RETENTION_DAYS = 7L
    }

    /**
     * Record a new impression when ad playback completes.
     *
     * @return The impression ID if recorded, null if duplicate (same slot_play_key).
     */
    suspend fun recordImpression(
        screenId: String,
        item: PlaylistItem,
        playedAt: Instant,
        durationSeconds: Int,
        expectedDurationSeconds: Int,
        wasFullPlay: Boolean,
        timezone: ZoneId
    ): String? {
        // Defensive guard: never record impressions for filler/default content
        // Primary guard is in PlaylistManager; this is the safety net
        if (item.isFillerContent) {
            Log.d(TAG, "Rejecting impression for filler content (slot ${item.slotNumber})")
            return null
        }

        val impressionId = UUID.randomUUID().toString()
        val playedAtUtc = DateTimeFormatter.ISO_INSTANT.format(playedAt)
        val playedAtLocal = LocalDateTime.ofInstant(playedAt, timezone)
            .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)

        val slotPlayKey = generateSlotPlayKey(
            screenId = screenId,
            slotNumber = item.slotNumber,
            playedAt = playedAt,
            timezone = timezone
        )

        val verificationHash = impressionVerifier.createImpressionHash(
            screenId = screenId,
            slotNumber = item.slotNumber,
            playedAt = playedAtUtc,
            bookingId = item.bookingId,
            campaignId = item.campaignId,
            ownerContentId = item.ownerContentId
        )

        val entity = ImpressionEntity(
            impressionId = impressionId,
            slotPlayKey = slotPlayKey,
            screenId = screenId,
            bookingId = item.bookingId,
            campaignId = item.campaignId,
            creativeId = item.creativeId,
            ownerContentId = item.ownerContentId,
            slotNumber = item.slotNumber,
            playedAt = playedAtUtc,
            playedAtLocal = playedAtLocal,
            durationSeconds = durationSeconds,
            expectedDurationSeconds = expectedDurationSeconds,
            wasFullPlay = wasFullPlay,
            verificationHash = verificationHash,
            createdAt = Instant.now().toString()
        )

        val rowId = impressionDao.insertOrIgnore(entity)
        return if (rowId != -1L) {
            Log.d(TAG, "Recorded impression $impressionId for slot ${item.slotNumber}")
            impressionId
        } else {
            Log.d(TAG, "Duplicate impression skipped for slot ${item.slotNumber}")
            null
        }
    }

    /**
     * Get pending impressions as payloads ready for sync API.
     */
    suspend fun getPendingPayloads(limit: Int = 500): List<ImpressionPayload> {
        return impressionDao.getPendingImpressions(limit).map { entity ->
            ImpressionPayload(
                slotPlayKey = entity.slotPlayKey,
                impressionId = entity.impressionId,
                bookingId = entity.bookingId,
                campaignId = entity.campaignId,
                creativeId = entity.creativeId,
                ownerContentId = entity.ownerContentId,
                slotNumber = entity.slotNumber,
                playedAt = entity.playedAt,
                verificationHash = entity.verificationHash ?: "",
                durationSeconds = entity.durationSeconds,
                expectedDurationSeconds = entity.expectedDurationSeconds,
                wasFullPlay = entity.wasFullPlay
            )
        }
    }

    /**
     * Mark impressions as synced after successful server upload.
     */
    suspend fun markSynced(impressionIds: List<String>, serverConfirmed: Boolean) {
        val now = Instant.now().toString()
        impressionDao.markSynced(impressionIds, serverConfirmed, now)
    }

    /**
     * Record a failed sync attempt.
     */
    suspend fun incrementSyncAttempts(impressionIds: List<String>) {
        val now = Instant.now().toString()
        impressionDao.incrementSyncAttempts(impressionIds, now)
    }

    /**
     * Log sync history for debugging.
     */
    suspend fun logSyncHistory(
        impressionsSent: Int,
        impressionsConfirmed: Int,
        impressionsDuplicate: Int,
        serverResponse: String?,
        success: Boolean
    ) {
        syncHistoryDao.insert(
            SyncHistoryEntity(
                syncTime = Instant.now().toString(),
                impressionsSent = impressionsSent,
                impressionsConfirmed = impressionsConfirmed,
                impressionsDuplicate = impressionsDuplicate,
                serverResponse = serverResponse,
                success = success
            )
        )
    }

    /**
     * Clean up old synced + confirmed impressions (7-day retention).
     */
    suspend fun cleanupOldImpressions() {
        val cutoff = Instant.now().minusSeconds(CLEANUP_RETENTION_DAYS * 86400).toString()
        val deleted = impressionDao.cleanupOldSynced(cutoff)
        if (deleted > 0) {
            Log.i(TAG, "Cleaned up $deleted old synced impressions")
        }
        syncHistoryDao.cleanupOld(cutoff)
    }

    /**
     * Get stats for debug overlay.
     */
    suspend fun getStats(): ImpressionStats {
        val todayPrefix = LocalDate.now(ZoneOffset.UTC).toString()
        return ImpressionStats(
            total = impressionDao.getTotalCount(),
            pending = impressionDao.getPendingCount(),
            today = impressionDao.getTodayCount(todayPrefix)
        )
    }

    /**
     * Generate SlotPlayKey — SHA256(screenId|date|slotNumber|YYYY-MM-DDTHH:MM:SS)
     *
     * Same algorithm as Pi's impression_store.py:generate_slot_play_key().
     * Second-level precision prevents the same slot from recording twice per second.
     */
    private fun generateSlotPlayKey(
        screenId: String,
        slotNumber: Int,
        playedAt: Instant,
        timezone: ZoneId
    ): String {
        val localDateTime = LocalDateTime.ofInstant(playedAt, timezone)
        val dateStr = localDateTime.toLocalDate().toString()
        val timeStr = localDateTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"))
        val raw = "$screenId|$dateStr|$slotNumber|$timeStr"

        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(raw.toByteArray(Charsets.UTF_8))
        return hash.joinToString("") { "%02x".format(it) }
    }
}

data class ImpressionStats(
    val total: Int,
    val pending: Int,
    val today: Int
)
