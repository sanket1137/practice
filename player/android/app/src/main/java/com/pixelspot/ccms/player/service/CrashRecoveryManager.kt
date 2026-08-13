package com.pixelspot.ccms.player.service

import android.app.AlarmManager
import android.app.Application
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import com.pixelspot.ccms.player.MainActivity

/**
 * Crash recovery mechanism for the CCMS player.
 *
 * Provides two layers of recovery:
 * 1. UncaughtExceptionHandler: schedules restart via AlarmManager on crash
 * 2. Safe mode: after repeated crashes (>5 in 1 hour), enters safe mode
 *    (plays default video only, skips SignalR) to prevent crash loops
 *
 * This replaces the Pi's watchdog.py process monitor.
 */
class CrashRecoveryManager(private val application: Application) {

    companion object {
        private const val TAG = "CrashRecovery"
        private const val PREFS_NAME = "crash_recovery"
        private const val KEY_CRASH_COUNT = "crash_count"
        private const val KEY_CRASH_WINDOW_START = "crash_window_start"
        private const val CRASH_THRESHOLD = 5
        private const val CRASH_WINDOW_MS = 3_600_000L    // 1 hour
        private const val RESTART_DELAY_MS = 5_000L        // 5 seconds
        private const val KEY_SAFE_MODE = "safe_mode"
    }

    private val prefs: SharedPreferences by lazy {
        application.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    /**
     * Install the global uncaught exception handler.
     * Call this from Application.onCreate().
     */
    fun install() {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()

        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Log.e(TAG, "Uncaught exception on ${thread.name}", throwable)

            recordCrash()

            if (!isInSafeMode()) {
                scheduleRestart()
            } else {
                Log.w(TAG, "In safe mode, not scheduling restart (too many crashes)")
            }

            // Call default handler to terminate the process
            defaultHandler?.uncaughtException(thread, throwable)
        }

        Log.i(TAG, "Crash recovery installed, safe_mode=${isInSafeMode()}")
    }

    /**
     * Record a crash and check if we've exceeded the threshold.
     */
    private fun recordCrash() {
        val now = System.currentTimeMillis()
        val windowStart = prefs.getLong(KEY_CRASH_WINDOW_START, 0)
        val count = prefs.getInt(KEY_CRASH_COUNT, 0)

        if (now - windowStart > CRASH_WINDOW_MS) {
            // Start a new crash window
            prefs.edit()
                .putLong(KEY_CRASH_WINDOW_START, now)
                .putInt(KEY_CRASH_COUNT, 1)
                .apply()
        } else {
            val newCount = count + 1
            prefs.edit()
                .putInt(KEY_CRASH_COUNT, newCount)
                .apply()

            if (newCount >= CRASH_THRESHOLD) {
                Log.w(TAG, "Crash threshold reached ($newCount in ${CRASH_WINDOW_MS}ms), entering safe mode")
                prefs.edit().putBoolean(KEY_SAFE_MODE, true).apply()
            }
        }
    }

    /**
     * Schedule a restart of the app via AlarmManager.
     */
    private fun scheduleRestart() {
        val intent = Intent(application, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            application, 0, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val alarmManager = application.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val triggerTime = System.currentTimeMillis() + RESTART_DELAY_MS

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (alarmManager.canScheduleExactAlarms()) {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            }
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
        }

        Log.i(TAG, "Restart scheduled in ${RESTART_DELAY_MS}ms")
    }

    /**
     * Check if in safe mode (too many recent crashes).
     */
    fun isInSafeMode(): Boolean = prefs.getBoolean(KEY_SAFE_MODE, false)

    /**
     * Exit safe mode (called after successful operation for a period).
     */
    fun exitSafeMode() {
        prefs.edit()
            .putBoolean(KEY_SAFE_MODE, false)
            .putInt(KEY_CRASH_COUNT, 0)
            .apply()
        Log.i(TAG, "Exited safe mode")
    }

    /**
     * Reset crash counter (called periodically when running normally).
     */
    fun resetCrashCounter() {
        prefs.edit()
            .putInt(KEY_CRASH_COUNT, 0)
            .apply()
    }
}
