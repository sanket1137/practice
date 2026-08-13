package com.pixelspot.ccms.player.config

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Typed configuration for the CCMS player.
 *
 * Stores screen_id, api_key, server_url in EncryptedSharedPreferences
 * (API key is sensitive — Pi stores in plaintext config.json, we encrypt).
 *
 * Replaces the Pi's config.json file with secure Android-native storage.
 */
@Singleton
class PlayerConfig @Inject constructor(
    @ApplicationContext private val context: Context
) {

    companion object {
        private const val TAG = "PlayerConfig"
        private const val PREFS_NAME = "ccms_player_config"
        private const val KEY_SCREEN_ID = "screen_id"
        private const val KEY_API_KEY = "api_key"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_CONFIGURED = "is_configured"
        private const val DEFAULT_SERVER_URL = "https://ccms.pixelspot.in"
    }

    private val prefs: SharedPreferences by lazy {
        try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create encrypted prefs, falling back to standard", e)
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }
    }

    var screenId: String?
        get() = prefs.getString(KEY_SCREEN_ID, null)
        set(value) = prefs.edit().putString(KEY_SCREEN_ID, value).apply()

    var apiKey: String?
        get() = prefs.getString(KEY_API_KEY, null)
        set(value) = prefs.edit().putString(KEY_API_KEY, value).apply()

    var serverUrl: String?
        get() = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL)
        set(value) = prefs.edit().putString(KEY_SERVER_URL, value).apply()

    val isConfigured: Boolean
        get() = prefs.getBoolean(KEY_CONFIGURED, false) &&
                !screenId.isNullOrBlank() &&
                !apiKey.isNullOrBlank()

    /**
     * Save all configuration at once (from SetupActivity).
     */
    fun configure(screenId: String, apiKey: String, serverUrl: String) {
        prefs.edit()
            .putString(KEY_SCREEN_ID, screenId)
            .putString(KEY_API_KEY, apiKey)
            .putString(KEY_SERVER_URL, serverUrl.ifBlank { DEFAULT_SERVER_URL })
            .putBoolean(KEY_CONFIGURED, true)
            .apply()
        Log.i(TAG, "Configuration saved for screen $screenId")
    }

    /**
     * Clear all configuration (factory reset).
     */
    fun clear() {
        prefs.edit().clear().apply()
        Log.i(TAG, "Configuration cleared")
    }
}
