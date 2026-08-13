package com.pixelspot.ccms.player

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.util.Log
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import com.pixelspot.ccms.player.service.CrashRecoveryManager
import dagger.hilt.android.HiltAndroidApp

/**
 * Hilt application class — entry point for dependency injection.
 * Also installs crash recovery handler and tracks foreground visibility.
 *
 * **Impression Guarding**: Exposes [isAppInForeground] flag used by
 * [PlaylistManager] to ensure impressions are only recorded when the
 * player UI is actively visible on the TV screen. If the app is in
 * background (e.g., user pressed Home), impressions are NOT counted.
 */
@HiltAndroidApp
class CcmsPlayerApp : Application() {

    companion object {
        private const val TAG = "CcmsPlayerApp"

        /**
         * Global flag indicating whether MainActivity is currently visible.
         * Used by PlaylistManager to guard impression recording.
         *
         * Impressions should ONLY be counted when:
         * 1. The app is in foreground (this flag is true)
         * 2. MainActivity (player UI) is visible on screen
         *
         * This prevents billing for impressions that users can't actually see.
         */
        @Volatile
        var isAppInForeground: Boolean = false
            private set

        /**
         * Reference to the current visible MainActivity (if any).
         * Used by PlayerService to bring the activity to front if needed.
         */
        @Volatile
        var currentActivity: Activity? = null
            private set
    }

    lateinit var crashRecoveryManager: CrashRecoveryManager
        private set

    override fun onCreate() {
        super.onCreate()

        // Install crash recovery (equivalent of Pi's watchdog.py)
        crashRecoveryManager = CrashRecoveryManager(this)
        crashRecoveryManager.install()

        // Track app foreground/background state using ProcessLifecycleOwner
        setupForegroundTracking()

        // Track current activity for foreground restoration
        registerActivityLifecycleCallbacks(activityLifecycleCallbacks)

        Log.i(TAG, "CcmsPlayerApp initialized")
    }

    /**
     * Use ProcessLifecycleOwner to track when the app moves to foreground/background.
     * This is more reliable than tracking individual activities.
     */
    private fun setupForegroundTracking() {
        ProcessLifecycleOwner.get().lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) {
                // App came to foreground (any activity visible)
                isAppInForeground = true
                Log.i(TAG, "App entered FOREGROUND — impressions will be recorded")
            }

            override fun onStop(owner: LifecycleOwner) {
                // App went to background (no activities visible)
                isAppInForeground = false
                Log.w(TAG, "App entered BACKGROUND — impressions will NOT be recorded")
            }
        })
    }

    /**
     * Track the current visible activity for foreground restoration.
     */
    private val activityLifecycleCallbacks = object : ActivityLifecycleCallbacks {
        override fun onActivityResumed(activity: Activity) {
            currentActivity = activity
            Log.d(TAG, "Activity resumed: ${activity.javaClass.simpleName}")
        }

        override fun onActivityPaused(activity: Activity) {
            if (currentActivity == activity) {
                currentActivity = null
            }
            Log.d(TAG, "Activity paused: ${activity.javaClass.simpleName}")
        }

        override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
        override fun onActivityStarted(activity: Activity) {}
        override fun onActivityStopped(activity: Activity) {}
        override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
        override fun onActivityDestroyed(activity: Activity) {
            if (currentActivity == activity) {
                currentActivity = null
            }
        }
    }
}
