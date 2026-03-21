package com.pixelspot.ccms.player

import android.app.Application
import com.pixelspot.ccms.player.service.CrashRecoveryManager
import dagger.hilt.android.HiltAndroidApp

/**
 * Hilt application class — entry point for dependency injection.
 * Also installs crash recovery handler.
 */
@HiltAndroidApp
class CcmsPlayerApp : Application() {

    lateinit var crashRecoveryManager: CrashRecoveryManager
        private set

    override fun onCreate() {
        super.onCreate()

        // Install crash recovery (equivalent of Pi's watchdog.py)
        crashRecoveryManager = CrashRecoveryManager(this)
        crashRecoveryManager.install()
    }
}
