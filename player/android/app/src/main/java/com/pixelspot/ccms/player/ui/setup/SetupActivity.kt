package com.pixelspot.ccms.player.ui.setup

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import com.pixelspot.ccms.player.MainActivity
import com.pixelspot.ccms.player.R
import com.pixelspot.ccms.player.config.PlayerConfig
import com.pixelspot.ccms.player.data.model.ClaimPairingCodeRequest
import com.pixelspot.ccms.player.data.remote.PlayerApiService
import com.pixelspot.ccms.player.data.model.HandshakeRequest
import com.pixelspot.ccms.player.security.DeviceFingerprint
import com.pixelspot.ccms.player.security.SecurityManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * First-run setup screen.
 *
 * Shows only when no configuration is present (first launch or factory reset).
 * User enters: Server URL, Screen ID (GUID), API Key.
 * Validates by attempting a handshake — shows success/error.
 *
 * On Android TV, navigable via D-pad/remote control.
 */
@AndroidEntryPoint
class SetupActivity : AppCompatActivity() {

    @Inject lateinit var playerConfig: PlayerConfig
    @Inject lateinit var apiService: PlayerApiService
    @Inject lateinit var deviceFingerprint: DeviceFingerprint
    @Inject lateinit var securityManager: SecurityManager

    private lateinit var serverUrlInput: EditText
    private lateinit var screenIdInput: EditText
    private lateinit var apiKeyInput: EditText
    private lateinit var connectButton: Button
    private lateinit var pairCodeButton: Button
    private lateinit var statusText: TextView
    private lateinit var progressBar: ProgressBar

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)

        serverUrlInput = findViewById(R.id.server_url_input)
        screenIdInput = findViewById(R.id.screen_id_input)
        apiKeyInput = findViewById(R.id.api_key_input)
        connectButton = findViewById(R.id.connect_button)
        pairCodeButton = findViewById(R.id.pair_code_button)
        statusText = findViewById(R.id.status_text)
        progressBar = findViewById(R.id.progress_bar)

        // Pre-fill server URL
        serverUrlInput.setText(playerConfig.serverUrl ?: "https://ccms.pixelspot.in")

        connectButton.setOnClickListener { validateAndConnect() }
        pairCodeButton.setOnClickListener { showPairingDialog() }

        // Check for emulator/root warnings
        if (deviceFingerprint.isEmulator()) {
            statusText.text = "⚠ Running on emulator — device registration may not work in production"
            statusText.isVisible = true
        }
    }

    private fun validateAndConnect() {
        val serverUrl = serverUrlInput.text.toString().trim()
        val screenId = screenIdInput.text.toString().trim()
        val apiKey = apiKeyInput.text.toString().trim()

        // Basic validation
        if (serverUrl.isBlank()) {
            serverUrlInput.error = "Server URL required"
            return
        }
        if (screenId.isBlank()) {
            screenIdInput.error = "Screen ID required"
            return
        }
        if (!screenId.matches(Regex("[0-9a-fA-F-]{36}"))) {
            screenIdInput.error = "Invalid GUID format"
            return
        }
        if (apiKey.isBlank()) {
            apiKeyInput.error = "API Key required"
            return
        }

        // Attempt handshake to validate credentials
        setLoading(true)
        statusText.text = "Connecting..."
        statusText.isVisible = true

        lifecycleScope.launch {
            try {
                val fingerprint = deviceFingerprint.generate()
                val nonce = securityManager.generateNonce()

                val request = HandshakeRequest(
                    screenId = screenId,
                    apiKey = apiKey,
                    apiKeyHash = securityManager.hashApiKey(apiKey),
                    deviceFingerprint = fingerprint,
                    nonce = nonce,
                    timestamp = System.currentTimeMillis() / 1000,
                    playerVersion = "1.0.0-android"
                )

                // Temporarily configure for this request
                playerConfig.configure(screenId, apiKey, serverUrl)

                val response = apiService.handshake(request)

                if (response.isSuccessful && response.body()?.success == true) {
                    val apiResp = response.body()!!
                    val data = apiResp.data
                    statusText.text = "✓ Connected! Device: ${data?.deviceBindingStatus ?: "ok"}"

                    Toast.makeText(this@SetupActivity, "Setup complete!", Toast.LENGTH_SHORT).show()

                    // Navigate to main player
                    startActivity(Intent(this@SetupActivity, MainActivity::class.java))
                    finish()
                } else {
                    val errorBody = response.errorBody()?.string() ?: response.body()?.message ?: "Unknown error"
                    statusText.text = "✗ Connection failed: ${response.code()} — $errorBody"
                    playerConfig.clear()  // Rollback config
                }
            } catch (e: Exception) {
                statusText.text = "✗ Error: ${e.message}"
                playerConfig.clear()  // Rollback config
            } finally {
                setLoading(false)
            }
        }
    }

    private fun setLoading(loading: Boolean) {
        progressBar.isVisible = loading
        connectButton.isEnabled = !loading
        serverUrlInput.isEnabled = !loading
        screenIdInput.isEnabled = !loading
        apiKeyInput.isEnabled = !loading
    }

    /**
     * Show a dialog that accepts a 6-character pairing code and posts it to
     * /api/v1/cms/pairing/claim. On success, persists credentials and jumps
     * straight to MainActivity — the user never touches screenId/apiKey.
     */
    private fun showPairingDialog() {
        val serverUrl = serverUrlInput.text.toString().trim().ifBlank { "https://ccms.pixelspot.in" }
        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_TEXT
            hint = "ABC123"
            textSize = 22f
            filters = arrayOf(android.text.InputFilter.LengthFilter(6),
                android.text.InputFilter.AllCaps())
        }
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 24, 48, 8)
            addView(input)
        }

        AlertDialog.Builder(this)
            .setTitle("Enter pairing code")
            .setMessage("Ask the screen owner to generate a code in the CMS dashboard.")
            .setView(container)
            .setPositiveButton("Pair") { _, _ ->
                val code = input.text.toString().trim().uppercase()
                if (code.length != 6) {
                    Toast.makeText(this, "Code must be 6 characters", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                claimPairingCode(serverUrl, code)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun claimPairingCode(serverUrl: String, code: String) {
        setLoading(true)
        statusText.text = "Claiming code $code..."
        statusText.isVisible = true

        lifecycleScope.launch {
            try {
                // Configure base URL before the Retrofit call (apiKey unknown yet; claim is anonymous)
                playerConfig.configure(
                    screenId = playerConfig.screenId ?: "00000000-0000-0000-0000-000000000000",
                    apiKey = playerConfig.apiKey ?: "",
                    serverUrl = serverUrl
                )

                val request = ClaimPairingCodeRequest(
                    code = code,
                    deviceFingerprint = deviceFingerprint.generate(),
                    deviceModel = Build.MODEL,
                    osVersion = "Android ${Build.VERSION.RELEASE}",
                    appVersion = "1.0.0-android"
                )

                val response = apiService.claimPairingCode(request)
                val body = response.body()
                if (response.isSuccessful && body?.success == true && body.data != null) {
                    val data = body.data
                    playerConfig.configure(data.screenId, data.apiKey, serverUrl)
                    statusText.text = "✓ Paired with ${data.screenName ?: "screen"}"
                    Toast.makeText(this@SetupActivity, "Paired successfully", Toast.LENGTH_SHORT).show()
                    startActivity(Intent(this@SetupActivity, MainActivity::class.java))
                    finish()
                } else {
                    val msg = body?.message ?: response.errorBody()?.string() ?: "Unknown error"
                    statusText.text = "✗ Pairing failed: $msg"
                    playerConfig.clear()
                }
            } catch (e: Exception) {
                statusText.text = "✗ Error: ${e.message}"
                playerConfig.clear()
            } finally {
                setLoading(false)
            }
        }
    }
}
