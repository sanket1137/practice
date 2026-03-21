package com.pixelspot.ccms.player.security

import com.google.gson.GsonBuilder
import com.pixelspot.ccms.player.config.PlayerConfig
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Creates verification hashes for impressions.
 *
 * Must match Pi's security_manager.py:create_impression_hash():
 * HMAC-SHA256(key=apiKey, message=canonicalJson({screenId, slotNumber, playedAt, bookingId, campaignId, ownerContentId}) + screenId + sessionToken[:16])
 * Returns first 32 hex chars.
 */
@Singleton
class ImpressionVerifier @Inject constructor(
    private val playerConfig: PlayerConfig,
    private val securityManager: SecurityManager
) {

    private val gson = GsonBuilder()
        .disableHtmlEscaping()
        .create()

    /**
     * Create a verification hash for an impression.
     */
    fun createImpressionHash(
        screenId: String,
        slotNumber: Int,
        playedAt: String,
        bookingId: String?,
        campaignId: String?,
        ownerContentId: String?
    ): String {
        val apiKey = playerConfig.apiKey ?: return ""

        // Build canonical data map (same field order as Pi)
        val data = linkedMapOf(
            "screen_id" to screenId,
            "slot_number" to slotNumber,
            "played_at" to playedAt,
            "booking_id" to (bookingId ?: ""),
            "campaign_id" to (campaignId ?: ""),
            "owner_content_id" to (ownerContentId ?: "")
        )

        val canonicalJson = gson.toJson(data)
        // Pi: f"{impression_data}{self.screen_id}{self.session_token[:16]}"
        val sessionPrefix = securityManager.getSessionTokenPrefix()
        val message = "$canonicalJson$screenId$sessionPrefix"

        val mac = Mac.getInstance("HmacSHA256")
        val secretKey = SecretKeySpec(apiKey.toByteArray(Charsets.UTF_8), "HmacSHA256")
        mac.init(secretKey)
        val hash = mac.doFinal(message.toByteArray(Charsets.UTF_8))

        // Return first 32 hex chars (same as Pi)
        return hash.joinToString("") { "%02x".format(it) }.take(32)
    }
}
