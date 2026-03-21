package com.pixelspot.ccms.player.verification

import android.app.Activity
import androidx.appcompat.app.AppCompatActivity
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import android.widget.ImageView
import android.widget.TextView
import android.widget.LinearLayout
import android.view.Gravity
import android.view.View
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.pixelspot.ccms.player.config.PlayerConfig
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.*
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Inject

/**
 * Fullscreen Activity that displays a QR code for physical screen verification.
 * Refreshes QR every 4 minutes, polls status every 10 seconds.
 * Finishes with RESULT_OK when screen is verified.
 */
@AndroidEntryPoint
class QrVerificationActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "QrVerification"
        private const val QR_REFRESH_INTERVAL_MS = 240_000L  // 4 minutes
        private const val STATUS_POLL_INTERVAL_MS = 10_000L  // 10 seconds
        const val RESULT_VERIFIED = Activity.RESULT_OK

        fun createIntent(context: Context): Intent {
            return Intent(context, QrVerificationActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        }
    }

    @Inject lateinit var playerConfig: PlayerConfig

    private lateinit var qrImageView: ImageView
    private lateinit var statusTextView: TextView
    private lateinit var titleTextView: TextView
    private lateinit var instructionTextView: TextView

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var verificationApi: VerificationApiService? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Fullscreen immersive + keep screen on
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        )

        // Build UI programmatically (no XML layout needed)
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0f172a"))
            setPadding(48, 48, 48, 48)
        }

        titleTextView = TextView(this).apply {
            text = "Screen Verification Required"
            textSize = 28f
            setTextColor(Color.parseColor("#f8fafc"))
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }
        layout.addView(titleTextView, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = 32 })

        qrImageView = ImageView(this).apply {
            adjustViewBounds = true
            scaleType = ImageView.ScaleType.FIT_CENTER
        }
        layout.addView(qrImageView, LinearLayout.LayoutParams(
            600, 600
        ).apply {
            gravity = Gravity.CENTER
            bottomMargin = 32
        })

        instructionTextView = TextView(this).apply {
            text = "Scan this QR code with your phone to verify this screen.\n" +
                   "You will need to record a short video showing the QR on screen."
            textSize = 18f
            setTextColor(Color.parseColor("#94a3b8"))
            gravity = Gravity.CENTER
        }
        layout.addView(instructionTextView, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = 48 })

        statusTextView = TextView(this).apply {
            text = "Waiting for verification..."
            textSize = 16f
            setTextColor(Color.parseColor("#6366f1"))
            gravity = Gravity.CENTER
        }
        layout.addView(statusTextView)

        setContentView(layout)

        // Initialize Retrofit for verification API
        val serverUrl = playerConfig.serverUrl ?: return
        verificationApi = Retrofit.Builder()
            .baseUrl(serverUrl.trimEnd('/') + "/")
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(VerificationApiService::class.java)

        // Start verification loops
        scope.launch { qrRefreshLoop() }
        scope.launch { statusPollLoop() }
    }

    private suspend fun qrRefreshLoop() {
        while (true) {
            requestAndDisplayQr()
            delay(QR_REFRESH_INTERVAL_MS)
        }
    }

    private suspend fun statusPollLoop() {
        while (true) {
            delay(STATUS_POLL_INTERVAL_MS)
            pollStatus()
        }
    }

    private suspend fun requestAndDisplayQr() {
        val api = verificationApi ?: return
        val screenId = playerConfig.screenId ?: return
        val apiKey = playerConfig.apiKey ?: return

        try {
            val response = withContext(Dispatchers.IO) {
                api.requestQrChallenge(screenId, QrChallengeRequest(apiKey))
            }
            val data = response.body()?.data
            if (data != null && data.qrContent.isNotBlank()) {
                val bitmap = generateQrBitmap(data.qrContent, 500)
                qrImageView.setImageBitmap(bitmap)
                Log.i(TAG, "QR challenge displayed, expires: ${data.expiresAt}")
            } else {
                Log.e(TAG, "QR challenge response empty: ${response.code()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "QR challenge request failed: ${e.message}", e)
        }
    }

    private suspend fun pollStatus() {
        val api = verificationApi ?: return
        val screenId = playerConfig.screenId ?: return

        try {
            val response = withContext(Dispatchers.IO) {
                api.getVerificationStatus(screenId)
            }
            val data = response.body()?.data ?: return

            withContext(Dispatchers.Main) {
                when (data.status) {
                    "Verified" -> {
                        statusTextView.text = "Verified! Starting playback..."
                        statusTextView.setTextColor(Color.parseColor("#22c55e"))
                        Log.i(TAG, "Screen verified!")
                        delay(1500)
                        setResult(RESULT_VERIFIED)
                        finish()
                    }
                    "PendingReview" -> {
                        statusTextView.text = "Verification submitted — awaiting admin review..."
                        statusTextView.setTextColor(Color.parseColor("#f59e0b"))
                    }
                    "Rejected" -> {
                        statusTextView.text = "Verification rejected. Please scan the new QR."
                        statusTextView.setTextColor(Color.parseColor("#ef4444"))
                    }
                    else -> {
                        statusTextView.text = "Waiting for verification..."
                        statusTextView.setTextColor(Color.parseColor("#6366f1"))
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Status poll failed: ${e.message}")
        }
    }

    private fun generateQrBitmap(content: String, size: Int): Bitmap {
        val hints = mapOf(
            EncodeHintType.MARGIN to 2,
            EncodeHintType.ERROR_CORRECTION to com.google.zxing.qrcode.decoder.ErrorCorrectionLevel.H
        )
        val bitMatrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size, hints)
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        for (x in 0 until size) {
            for (y in 0 until size) {
                bitmap.setPixel(x, y, if (bitMatrix[x, y]) Color.WHITE else Color.parseColor("#0f172a"))
            }
        }
        return bitmap
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
