package com.pixelspot.ccms.player.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.pixelspot.ccms.player.MainActivity

/**
 * Starts the CCMS Player in full-screen when the device boots.
 *
 * This is the Android equivalent of the Pi's systemd service auto-start.
 * Registered in AndroidManifest.xml for BOOT_COMPLETED and QUICKBOOT_POWERON.
 *
 * **Important**: On boot, we launch MainActivity (not just the service) to ensure
 * the player UI is visible in foreground on the TV. Impressions are only counted
 * when the UI is visible — running as background service won't record impressions.
 *
 * Requirements:
 * - RECEIVE_BOOT_COMPLETED permission in manifest
 * - App must have been launched at least once (Android restriction since API 31)
 * - Config must be set up (screen_id, api_key) — MainActivity checks this on start
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
        const val EXTRA_BOOT_LAUNCH = "boot_launch"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED &&
            intent.action != "android.intent.action.QUICKBOOT_POWERON") {
            return
        }

        Log.i(TAG, "Boot completed, launching MainActivity in full-screen mode")

        // Launch MainActivity in full-screen — this ensures the player UI is visible
        // on the TV and impressions can be recorded. MainActivity will start the
        // PlayerService internally once it's in foreground.
        val activityIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TASK or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_BOOT_LAUNCH, true)
        }
        context.startActivity(activityIntent)

        Log.i(TAG, "MainActivity launch intent sent")
    }
}
