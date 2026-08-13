package com.pixelspot.ccms.player.player

import android.content.Context
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.URL
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages the default/fallback video for when playlist is empty.
 *
 * Downloads the screen-specific or universal fallback video and caches it locally.
 * Same concept as Pi's default_video_manager.py.
 */
@Singleton
class DefaultVideoManager @Inject constructor(
    @ApplicationContext private val context: Context
) {

    companion object {
        private const val TAG = "DefaultVideoManager"
        private const val DEFAULT_DIR = "default_videos"
        private const val UNIVERSAL_FALLBACK_NAME = "Pixel_Universal.mp4"
        private const val MAX_AGE_DAYS = 7L
    }

    private val defaultDir = File(context.filesDir, DEFAULT_DIR).also { it.mkdirs() }

    /**
     * Get the local path to the default video.
     * Downloads if not cached or stale (>7 days old).
     *
     * @param screenDefaultUrl Screen-specific default video URL from handshake
     * @param universalFallbackUrl Universal fallback URL from config
     * @return Local file path, or null if no default video available
     */
    suspend fun getDefaultVideoPath(
        screenDefaultUrl: String?,
        universalFallbackUrl: String? = null
    ): String? = withContext(Dispatchers.IO) {
        // Try screen-specific default first
        val url = screenDefaultUrl ?: universalFallbackUrl
        if (url.isNullOrBlank()) {
            Log.w(TAG, "No default video URL available")
            return@withContext null
        }

        val fileName = url.substringAfterLast("/").ifBlank { UNIVERSAL_FALLBACK_NAME }
        val localFile = File(defaultDir, fileName)

        // Check if cached and fresh
        if (localFile.exists()) {
            val ageMs = System.currentTimeMillis() - localFile.lastModified()
            val ageDays = ageMs / (1000 * 60 * 60 * 24)
            if (ageDays < MAX_AGE_DAYS) {
                Log.d(TAG, "Using cached default video: ${localFile.absolutePath}")
                return@withContext localFile.absolutePath
            }
            Log.i(TAG, "Default video cache expired ($ageDays days), re-downloading")
        }

        // Download
        try {
            Log.i(TAG, "Downloading default video from $url")
            val connection = URL(url).openConnection()
            connection.connectTimeout = 30_000
            connection.readTimeout = 60_000
            connection.getInputStream().use { input ->
                FileOutputStream(localFile).use { output ->
                    input.copyTo(output)
                }
            }
            Log.i(TAG, "Default video downloaded: ${localFile.length() / 1024}KB")
            localFile.absolutePath
        } catch (e: Exception) {
            Log.e(TAG, "Failed to download default video: ${e.message}", e)
            // Return existing cached version if download fails
            if (localFile.exists()) localFile.absolutePath else null
        }
    }

    /**
     * Clean up old cached default videos.
     */
    suspend fun cleanup() = withContext(Dispatchers.IO) {
        defaultDir.listFiles()?.forEach { file ->
            val ageDays = (System.currentTimeMillis() - file.lastModified()) / (1000 * 60 * 60 * 24)
            if (ageDays > MAX_AGE_DAYS * 2) {
                file.delete()
                Log.d(TAG, "Deleted old default video: ${file.name}")
            }
        }
    }
}
