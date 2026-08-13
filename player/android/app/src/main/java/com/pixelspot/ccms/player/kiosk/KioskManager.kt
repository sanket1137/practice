package com.pixelspot.ccms.player.kiosk

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages kiosk mode (lock task mode) for Android TV digital signage.
 *
 * Kiosk mode locks the device to the CCMS player app:
 * - Disables home, back, recent apps buttons
 * - Hides status bar and navigation bar
 * - Prevents notification access
 * - Keeps screen on during operating hours
 *
 * Requires the app to be set as device owner:
 * ```
 * adb shell dpm set-device-owner com.pixelspot.ccms.player/.kiosk.AdminReceiver
 * ```
 *
 * This is the Android equivalent of the Pi's kiosk display config in setup-raspberry-pi.sh.
 */
@Singleton
class KioskManager @Inject constructor(
    @ApplicationContext private val context: Context
) {

    companion object {
        private const val TAG = "KioskManager"
    }

    private val devicePolicyManager: DevicePolicyManager by lazy {
        context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    }

    private val adminComponent: ComponentName by lazy {
        ComponentName(context, AdminReceiver::class.java)
    }

    /**
     * Check if this app is set as device owner.
     */
    fun isDeviceOwner(): Boolean {
        return devicePolicyManager.isDeviceOwnerApp(context.packageName)
    }

    /**
     * Enter kiosk mode — locks the activity to the screen.
     * Call this from Activity.onResume().
     */
    fun enterKioskMode(activity: Activity) {
        if (!isDeviceOwner()) {
            Log.w(TAG, "Not device owner, kiosk mode unavailable. Run: adb shell dpm set-device-owner com.pixelspot.ccms.player/.kiosk.AdminReceiver")
            // Still apply fullscreen even without device owner
            setFullscreen(activity)
            return
        }

        try {
            // Whitelist this app for lock task mode
            devicePolicyManager.setLockTaskPackages(
                adminComponent,
                arrayOf(context.packageName)
            )

            // Start lock task
            activity.startLockTask()

            // Set lock task features (what's allowed during lock)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                devicePolicyManager.setLockTaskFeatures(
                    adminComponent,
                    DevicePolicyManager.LOCK_TASK_FEATURE_NONE
                )
            }

            setFullscreen(activity)
            keepScreenOn(activity)

            Log.i(TAG, "Kiosk mode enabled")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to enter kiosk mode: ${e.message}", e)
            setFullscreen(activity)
        }
    }

    /**
     * Exit kiosk mode.
     * Call this for maintenance/setup access.
     */
    fun exitKioskMode(activity: Activity) {
        try {
            activity.stopLockTask()
            Log.i(TAG, "Kiosk mode disabled")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to exit kiosk mode: ${e.message}")
        }
    }

    /**
     * Set the activity to fullscreen — hide system bars.
     */
    private fun setFullscreen(activity: Activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            activity.window.insetsController?.let { controller ->
                controller.hide(WindowInsets.Type.systemBars())
                controller.systemBarsBehavior =
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            activity.window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                )
        }
    }

    /**
     * Keep screen on during playback.
     */
    private fun keepScreenOn(activity: Activity) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    /**
     * Allow screen to turn off (outside operating hours).
     */
    fun allowScreenOff(activity: Activity) {
        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
}
