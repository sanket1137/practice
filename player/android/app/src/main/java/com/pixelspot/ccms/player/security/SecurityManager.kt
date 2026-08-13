package com.pixelspot.ccms.player.security

import android.util.Log
import com.google.gson.GsonBuilder
import com.pixelspot.ccms.player.config.PlayerConfig
import java.time.Duration
import java.time.Instant
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Handles HMAC-SHA256 request signing and session management.
 *
 * Must be 100% compatible with the Pi's security_manager.py:
 * - createSignature: HMAC-SHA256(key=apiKey+serverSalt, message=canonicalJson|timestamp|sessionToken)
 * - createSecureRequestHeaders: X-Screen-Id, X-Timestamp, X-Signature, X-Session-Token
 * - Session token from handshake (24h expiry), re-handshake when expired
 */
@Singleton
class SecurityManager @Inject constructor(
    private val playerConfig: PlayerConfig,
    private val deviceFingerprint: DeviceFingerprint
) {

    companion object {
        private const val TAG = "SecurityManager"
        private const val MAX_TIMESTAMP_DRIFT_SECONDS = 300L  // 5 minutes
    }

    private var sessionToken: String? = null
    private var serverSalt: String? = null
    private var sessionExpiresAt: Instant? = null

    private val gson = GsonBuilder()
        .disableHtmlEscaping()
        .create()

    /**
     * SHA-256 hex digest of the API key.
     * Sent in handshake request (server verifies via BCrypt separately).
     */
    fun hashApiKey(apiKey: String): String {
        val digest = java.security.MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(apiKey.toByteArray(Charsets.UTF_8))
        return hash.joinToString("") { "%02x".format(it) }
    }

    /**
     * Generate a cryptographic nonce (32 random hex bytes).
     */
    fun generateNonce(): String {
        val bytes = ByteArray(32)
        java.security.SecureRandom().nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }

    /**
     * Get the device fingerprint string.
     */
    fun getDeviceFingerprint(): String = deviceFingerprint.generate()

    /**
     * Process handshake response — store session credentials.
     */
    fun processHandshakeResponse(sessionToken: String, serverSalt: String, expiresAt: String) {
        this.sessionToken = sessionToken
        this.serverSalt = serverSalt
        this.sessionExpiresAt = Instant.parse(expiresAt)
        Log.i(TAG, "Session initialized, expires at $expiresAt")
    }

    /**
     * Whether the current session is still valid.
     */
    fun isSessionValid(): Boolean {
        val token = sessionToken ?: return false
        val expires = sessionExpiresAt ?: return false
        return token.isNotBlank() && Instant.now().isBefore(expires)
    }

    /**
     * Create HMAC-SHA256 signature for a request payload.
     *
     * Matches Pi's security_manager.py:create_signature():
     * message = canonical_json(payload) | timestamp | session_token
     * key = api_key + server_salt
     */
    fun createSignature(payload: Any, timestamp: String): String {
        val apiKey = playerConfig.apiKey ?: throw IllegalStateException("API key not configured")
        val salt = serverSalt ?: ""
        val token = sessionToken ?: ""

        val canonicalJson = gson.toJson(payload)
        val message = "$canonicalJson|$timestamp|$token"
        val key = apiKey + salt

        return hmacSha256(key, message)
    }

    /**
     * Create secure request headers for authenticated API calls.
     *
     * Returns: X-Screen-Id, X-Timestamp, X-Signature, X-Session-Token
     */
    fun createSecureRequestHeaders(payload: Any): Map<String, String> {
        val screenId = playerConfig.screenId ?: throw IllegalStateException("Screen ID not configured")
        val timestamp = Instant.now().toString()
        val signature = createSignature(payload, timestamp)

        return mapOf(
            "X-Screen-Id" to screenId,
            "X-Timestamp" to timestamp,
            "X-Signature" to signature,
            "X-Session-Token" to (sessionToken ?: "")
        )
    }

    /**
     * Get the first 16 chars of the session token (for impression hash).
     */
    fun getSessionTokenPrefix(): String {
        return sessionToken?.take(16) ?: ""
    }

    /**
     * HMAC-SHA256 helper.
     */
    private fun hmacSha256(key: String, message: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        val secretKey = SecretKeySpec(key.toByteArray(Charsets.UTF_8), "HmacSHA256")
        mac.init(secretKey)
        val hash = mac.doFinal(message.toByteArray(Charsets.UTF_8))
        return hash.joinToString("") { "%02x".format(it) }
    }
}
