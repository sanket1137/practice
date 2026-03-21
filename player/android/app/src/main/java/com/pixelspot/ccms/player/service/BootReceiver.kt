package com.pixelspot.ccms.player.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Starts the PlayerService when the device boots.
 *
 * This is the Android equivalent of the Pi's systemd service auto-start.
 * Registered in AndroidManifest.xml for BOOT_COMPLETED and QUICKBOOT_POWERON.
 *
 * Requirements:
 * - RECEIVE_BOOT_COMPLETED permission in manifest
 * - App must have been launched at least once (Android restriction since API 31)
 * - Config must be set up (screen_id, api_key) — service checks this on start
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED &&
            intent.action != "android.intent.action.QUICKBOOT_POWERON") {
            return
        }

        Log.i(TAG, "Boot completed, starting PlayerService")

        val serviceIntent = Intent(context, PlayerService::class.java).apply {
            action = PlayerService.ACTION_START
        }

        // Android 8.0+ requires startForegroundService for background starts
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}
