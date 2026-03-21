package com.pixelspot.ccms.player.kiosk

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Device Admin Receiver required for kiosk (lock task) mode.
 *
 * Set as device owner via ADB:
 * ```
 * adb shell dpm set-device-owner com.pixelspot.ccms.player/.kiosk.AdminReceiver
 * ```
 *
 * Note: Device owner can only be set when no accounts are configured on the device.
 * For Android TV devices, factory reset first, then set device owner during initial setup.
 */
class AdminReceiver : DeviceAdminReceiver() {

    companion object {
        private const val TAG = "AdminReceiver"
    }

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.i(TAG, "Device admin enabled")
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.i(TAG, "Device admin disabled")
    }

    override fun onLockTaskModeEntering(context: Context, intent: Intent, pkg: String) {
        super.onLockTaskModeEntering(context, intent, pkg)
        Log.i(TAG, "Entering lock task mode for $pkg")
    }

    override fun onLockTaskModeExiting(context: Context, intent: Intent) {
        super.onLockTaskModeExiting(context, intent)
        Log.i(TAG, "Exiting lock task mode")
    }
}
