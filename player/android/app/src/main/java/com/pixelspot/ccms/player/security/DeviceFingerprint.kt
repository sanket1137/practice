package com.pixelspot.ccms.player.security

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.provider.Settings
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import java.net.NetworkInterface
import java.security.MessageDigest
import java.util.Base64
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Generates a device fingerprint compatible with the backend's PlayerDeviceManager.
 *
 * Backend expects: GenerateFingerprint(cpuSerial, diskSerial, macAddress, hostname)
 * which joins with "|", uppercases, SHA-256, returns Base64.
 *
 * On Android, we map:
 * - cpuSerial  → Settings.Secure.ANDROID_ID (unique per device+app combo)
 * - diskSerial → Build.FINGERPRINT (hardware + build identifier)
 * - macAddress → First non-loopback MAC address
 * - hostname   → Build.MODEL + "_" + Build.MANUFACTURER
 *
 * Also includes anti-fraud checks:
 * - Emulator detection (generic fingerprint, SDK model, goldfish hardware)
 * - Root detection (su binary, Magisk, test-keys)
 */
@Singleton
class DeviceFingerprint @Inject constructor(
    @ApplicationContext private val context: Context
) {

    companion object {
        private const val TAG = "DeviceFingerprint"
    }

    /**
     * Generate the SHA-256 Base64 device fingerprint.
     * Must match the server's GenerateFingerprint() algorithm exactly.
     */
    fun generate(): String {
        val cpuSerial = getCpuSerial()
        val diskSerial = getDiskSerial()
        val macAddress = getMacAddress()
        val hostname = getHostname()

        // Backend: $"{cpuSerial}|{diskSerial}|{macAddress}|{hostname}".ToUpperInvariant()
        val raw = "$cpuSerial|$diskSerial|$macAddress|$hostname".uppercase()

        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(raw.toByteArray(Charsets.UTF_8))
        val fingerprint = Base64.getEncoder().encodeToString(hash)

        Log.d(TAG, "Fingerprint generated (components: cpu=$cpuSerial, disk=${diskSerial.take(20)}..., mac=$macAddress, host=$hostname)")
        return fingerprint
    }

    /**
     * Get raw fingerprint components for server-side audit.
     */
    fun getComponents(): FingerprintComponents {
        return FingerprintComponents(
            cpuSerial = getCpuSerial(),
            diskSerial = getDiskSerial(),
            macAddress = getMacAddress(),
            hostname = getHostname()
        )
    }

    // ── Component getters ──

    @SuppressLint("HardwareIds")
    private fun getCpuSerial(): String {
        return try {
            Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
                ?: "UNKNOWN_ANDROID_ID"
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get ANDROID_ID: ${e.message}")
            "UNKNOWN_ANDROID_ID"
        }
    }

    private fun getDiskSerial(): String {
        return Build.FINGERPRINT.ifBlank { "UNKNOWN_FINGERPRINT" }
    }

    private fun getMacAddress(): String {
        return try {
            NetworkInterface.getNetworkInterfaces()?.toList()
                ?.firstOrNull { !it.isLoopback && it.hardwareAddress != null }
                ?.hardwareAddress
                ?.joinToString(":") { "%02X".format(it) }
                ?: "00:00:00:00:00:00"
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get MAC address: ${e.message}")
            "00:00:00:00:00:00"
        }
    }

    private fun getHostname(): String {
        return "${Build.MODEL}_${Build.MANUFACTURER}".ifBlank { "UNKNOWN_DEVICE" }
    }

    // ── Anti-fraud checks ──

    /**
     * Detect if running on an emulator.
     */
    fun isEmulator(): Boolean {
        return (Build.FINGERPRINT.contains("generic", ignoreCase = true)
                || Build.MODEL.contains("sdk", ignoreCase = true)
                || Build.MODEL.contains("emulator", ignoreCase = true)
                || Build.MANUFACTURER.contains("genymotion", ignoreCase = true)
                || Build.HARDWARE.contains("goldfish", ignoreCase = true)
                || Build.HARDWARE.contains("ranchu", ignoreCase = true)
                || Build.PRODUCT.contains("sdk", ignoreCase = true)
                || Build.BOARD.equals("unknown", ignoreCase = true))
    }

    /**
     * Detect if the device is rooted (basic checks).
     */
    fun isRooted(): Boolean {
        // Check for su binary
        val suPaths = listOf(
            "/system/app/Superuser.apk",
            "/sbin/su", "/system/bin/su", "/system/xbin/su",
            "/data/local/xbin/su", "/data/local/bin/su", "/data/local/su",
            "/system/sd/xbin/su", "/system/bin/failsafe/su"
        )
        val hasSu = suPaths.any { java.io.File(it).exists() }

        // Check for test-keys build
        val isTestKeys = Build.TAGS?.contains("test-keys") == true

        // Check for Magisk
        val hasMagisk = java.io.File("/sbin/.magisk").exists() ||
                java.io.File("/cache/.disable_magisk").exists()

        return hasSu || isTestKeys || hasMagisk
    }
}

data class FingerprintComponents(
    val cpuSerial: String,
    val diskSerial: String,
    val macAddress: String,
    val hostname: String
)
