package com.pixelspot.ccms.player.streaming

import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import org.webrtc.*
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages WebRTC streaming from the Android player to dashboard viewers.
 *
 * Architecture mirrors Pi player's webrtc_streamer.py:
 * - Screen capture via MediaProjection (Pi uses mss screen-grab)
 * - Multi-viewer support via separate PeerConnections (Pi uses MediaRelay)
 * - Quality: 720p @ 15fps default (matching Pi's "medium" preset)
 * - ICE negotiation via StreamingHub SignalR
 *
 * All external APIs use simple types (strings/ints) to avoid leaking
 * org.webrtc types into the rest of the codebase.
 *
 * Lifecycle:
 * 1. [initialize] on service start — sets up PeerConnectionFactory
 * 2. [setMediaProjectionPermission] from Activity — stores capture permission
 * 3. [addViewer] on SignalR "OnViewerConnected" — creates PC + offer
 * 4. [handleAnswer] / [handleIceCandidate] — WebRTC negotiation
 * 5. [removeViewer] on disconnect — cleanup
 * 6. [release] on service stop — full cleanup
 */
@Singleton
class WebRTCStreamer @Inject constructor(
    @ApplicationContext private val context: Context
) {

    companion object {
        private const val TAG = "WebRTCStreamer"
        private const val MAX_VIEWERS = 5
        private const val VIDEO_TRACK_ID = "screen-capture-track"
        private const val STREAM_ID = "screen-capture-stream"

        // Quality preset — matches Pi's "medium" (720p @ 15fps)
        private const val VIDEO_WIDTH = 1280
        private const val VIDEO_HEIGHT = 720
        private const val VIDEO_FPS = 15
    }

    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var eglBase: EglBase? = null
    private val viewers = ConcurrentHashMap<String, PeerConnection>()
    private var mediaProjectionData: Intent? = null

    /**
     * Viewers that connected before MediaProjection permission was granted.
     * Drained immediately when [setMediaProjectionPermission] is called.
     */
    private val pendingViewers = mutableListOf<String>()
    private var videoCapturer: ScreenCapturerAndroid? = null
    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private var isInitialized = false
    private var isCapturing = false
    private var iceServers: List<PeerConnection.IceServer> = emptyList()

    // ── Signaling callbacks (string-based for clean separation) ──
    /** Called when a local SDP offer is created for a viewer. */
    var onLocalOffer: ((viewerId: String, sdpType: String, sdpContent: String) -> Unit)? = null
    /** Called when a local ICE candidate is generated for a viewer. */
    var onLocalIceCandidate: ((viewerId: String, candidate: String, sdpMid: String, sdpMLineIndex: Int) -> Unit)? = null
    /** Called when a viewer's PeerConnection disconnects. */
    var onViewerDisconnected: ((viewerId: String) -> Unit)? = null

    /**
     * Initialize WebRTC with STUN/TURN server URLs.
     * Must be called before any streaming operations.
     */
    fun initialize(stunUrls: List<String>) {
        if (isInitialized) return

        this.iceServers = stunUrls.map { url ->
            PeerConnection.IceServer.builder(url).createIceServer()
        }

        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(context)
                .setEnableInternalTracer(false)
                .createInitializationOptions()
        )

        eglBase = EglBase.create()
        val eglContext = eglBase!!.eglBaseContext

        peerConnectionFactory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(eglContext, true, true))
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(eglContext))
            .createPeerConnectionFactory()

        isInitialized = true
        Log.i(TAG, "WebRTC initialized with ${stunUrls.size} ICE servers")
    }

    /**
     * Store MediaProjection permission result for later use.
     * Called from Activity after user grants screen capture permission.
     */
    fun setMediaProjectionPermission(resultData: Intent) {
        this.mediaProjectionData = resultData
        Log.i(TAG, "MediaProjection permission stored")

        // Drain any viewers that connected before permission was granted
        if (pendingViewers.isNotEmpty()) {
            Log.i(TAG, "Draining ${pendingViewers.size} pending viewer(s) now that permission is granted")
            val toAdd = pendingViewers.toList()
            pendingViewers.clear()
            toAdd.forEach { addViewer(it) }
        }
    }

    /** Whether MediaProjection permission has been granted. */
    val hasPermission: Boolean get() = mediaProjectionData != null

    // ── Screen capture (shared across all viewers) ──

    private fun startCapture() {
        if (isCapturing) return

        val permissionData = mediaProjectionData ?: run {
            Log.e(TAG, "No MediaProjection permission — cannot capture screen")
            return
        }

        val factory = peerConnectionFactory ?: return

        videoCapturer = ScreenCapturerAndroid(permissionData, object : MediaProjection.Callback() {
            override fun onStop() {
                Log.w(TAG, "MediaProjection stopped by system")
                stopCapture()
            }
        })

        surfaceTextureHelper = SurfaceTextureHelper.create(
            "CaptureThread", eglBase!!.eglBaseContext
        )

        videoSource = factory.createVideoSource(/* isScreencast = */ true)
        videoCapturer?.initialize(surfaceTextureHelper, context, videoSource?.capturerObserver)
        videoCapturer?.startCapture(VIDEO_WIDTH, VIDEO_HEIGHT, VIDEO_FPS)

        videoTrack = factory.createVideoTrack(VIDEO_TRACK_ID, videoSource).apply {
            setEnabled(true)
        }

        isCapturing = true
        Log.i(TAG, "Screen capture started: ${VIDEO_WIDTH}x${VIDEO_HEIGHT} @ ${VIDEO_FPS}fps")
    }

    private fun stopCapture() {
        try { videoCapturer?.stopCapture() } catch (_: Exception) {}
        try { videoCapturer?.dispose() } catch (_: Exception) {}
        videoCapturer = null
        videoSource?.dispose()
        videoSource = null
        videoTrack?.dispose()
        videoTrack = null
        surfaceTextureHelper?.dispose()
        surfaceTextureHelper = null
        isCapturing = false
        Log.i(TAG, "Screen capture stopped")
    }

    // ── Viewer management ──

    /**
     * Handle new viewer connection — create PeerConnection and generate offer.
     * Called when StreamingHub sends "OnViewerConnected".
     */
    fun addViewer(viewerId: String) {
        if (viewers.size >= MAX_VIEWERS) {
            Log.w(TAG, "Max viewers ($MAX_VIEWERS) reached, rejecting $viewerId")
            return
        }
        if (!isInitialized) {
            Log.e(TAG, "Cannot add viewer: not initialized yet, dropping $viewerId")
            return
        }
        if (!hasPermission) {
            // Queue viewer — will be added once the user grants MediaProjection permission
            Log.w(TAG, "MediaProjection permission not yet granted — queuing viewer $viewerId")
            if (!pendingViewers.contains(viewerId)) pendingViewers.add(viewerId)
            return
        }

        // Start capture if not already running (lazy — only when first viewer connects)
        startCapture()

        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        }

        val observer = ViewerPeerConnectionObserver(viewerId)
        val pc = peerConnectionFactory?.createPeerConnection(rtcConfig, observer)
        if (pc == null) {
            Log.e(TAG, "Failed to create PeerConnection for $viewerId")
            return
        }

        // Add the shared video track to this viewer's connection
        videoTrack?.let { track -> pc.addTrack(track, listOf(STREAM_ID)) }
        viewers[viewerId] = pc

        // Create and send SDP offer
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "false"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "false"))
        }
        pc.createOffer(object : SdpObserverAdapter("CreateOffer[$viewerId]") {
            override fun onCreateSuccess(sdp: SessionDescription) {
                pc.setLocalDescription(SdpObserverAdapter("SetLocal[$viewerId]"), sdp)
                onLocalOffer?.invoke(viewerId, sdp.type.canonicalForm(), sdp.description)
                Log.i(TAG, "Offer created for viewer $viewerId")
            }
        }, constraints)

        Log.i(TAG, "Viewer $viewerId added (${viewers.size}/$MAX_VIEWERS)")
    }

    /**
     * Apply viewer's SDP answer (string-based API).
     */
    fun handleAnswer(viewerId: String, sdpType: String, sdpContent: String) {
        val pc = viewers[viewerId] ?: run {
            Log.w(TAG, "No PeerConnection for viewer $viewerId")
            return
        }
        val sdp = SessionDescription(
            SessionDescription.Type.fromCanonicalForm(sdpType),
            sdpContent
        )
        pc.setRemoteDescription(SdpObserverAdapter("SetRemote[$viewerId]"), sdp)
        Log.d(TAG, "Remote description set for viewer $viewerId")
    }

    /**
     * Add ICE candidate from viewer (string-based API).
     */
    fun handleIceCandidate(viewerId: String, candidate: String, sdpMid: String, sdpMLineIndex: Int) {
        viewers[viewerId]?.addIceCandidate(IceCandidate(sdpMid, sdpMLineIndex, candidate))
    }

    /**
     * Remove a viewer and clean up their PeerConnection.
     */
    fun removeViewer(viewerId: String) {
        val pc = viewers.remove(viewerId) ?: return
        try { pc.close() } catch (_: Exception) {}
        try { pc.dispose() } catch (_: Exception) {}
        Log.i(TAG, "Viewer $viewerId removed (${viewers.size}/$MAX_VIEWERS remaining)")

        // Stop capture when no viewers left (saves resources)
        if (viewers.isEmpty() && isCapturing) {
            stopCapture()
        }
    }

    /** Current active viewer count. */
    val viewerCount: Int get() = viewers.size

    /** Whether streaming is active (has viewers and capturing). */
    val isStreaming: Boolean get() = viewers.isNotEmpty() && isCapturing

    /** Release all resources. */
    fun release() {
        viewers.keys.toList().forEach { removeViewer(it) }
        stopCapture()
        peerConnectionFactory?.dispose()
        peerConnectionFactory = null
        eglBase?.release()
        eglBase = null
        isInitialized = false
        Log.i(TAG, "WebRTC resources released")
    }

    // ── Inner classes ──

    /**
     * Per-viewer PeerConnection observer.
     * Forwards ICE candidates and detects disconnect/failure.
     */
    private inner class ViewerPeerConnectionObserver(
        private val viewerId: String
    ) : PeerConnection.Observer {

        override fun onIceCandidate(candidate: IceCandidate) {
            onLocalIceCandidate?.invoke(viewerId, candidate.sdp, candidate.sdpMid, candidate.sdpMLineIndex)
        }

        override fun onIceCandidatesRemoved(candidates: Array<IceCandidate>) {}

        override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
            Log.d(TAG, "Viewer $viewerId ICE: $state")
            if (state == PeerConnection.IceConnectionState.DISCONNECTED ||
                state == PeerConnection.IceConnectionState.FAILED
            ) {
                removeViewer(viewerId)
                onViewerDisconnected?.invoke(viewerId)
            }
        }

        override fun onIceConnectionReceivingChange(receiving: Boolean) {}
        override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {}
        override fun onSignalingChange(state: PeerConnection.SignalingState) {}
        override fun onAddStream(stream: MediaStream) {}
        override fun onRemoveStream(stream: MediaStream) {}
        override fun onDataChannel(channel: DataChannel) {}
        override fun onRenegotiationNeeded() {}
        override fun onAddTrack(receiver: RtpReceiver, streams: Array<MediaStream>) {}
    }

    /**
     * Simplified SDP observer that logs errors.
     * Override [onCreateSuccess] for offer/answer creation callbacks.
     */
    private open class SdpObserverAdapter(private val label: String) : SdpObserver {
        override fun onCreateSuccess(sdp: SessionDescription) {}
        override fun onSetSuccess() {}
        override fun onCreateFailure(error: String) {
            Log.e(TAG, "$label: SDP create failed: $error")
        }
        override fun onSetFailure(error: String) {
            Log.e(TAG, "$label: SDP set failed: $error")
        }
    }
}
