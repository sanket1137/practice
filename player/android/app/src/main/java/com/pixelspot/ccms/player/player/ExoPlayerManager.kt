package com.pixelspot.ccms.player.player

import android.content.Context
import android.util.Log
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import android.net.Uri
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.cache.CacheWriter
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages ExoPlayer for gapless ad video playback.
 *
 * Key features:
 * - Gapless sequential playback via ExoPlayer's playlist API
 * - OkHttp data source for consistent HTTP handling
 * - Disk-bounded LRU cache (10 GB max) for pre-caching next items
 * - Player.Listener callbacks for impression tracking on item transitions
 */
@Singleton
class ExoPlayerManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val okHttpClient: OkHttpClient
) {

    companion object {
        private const val TAG = "ExoPlayerManager"
        private const val CACHE_DIR_NAME = "video_cache"
        private const val MAX_CACHE_BYTES = 10L * 1024 * 1024 * 1024  // 10 GB
    }

    private var exoPlayer: ExoPlayer? = null
    private var cache: SimpleCache? = null
    private var onItemTransition: ((Int, Int, Int) -> Unit)? = null  // (previousIndex, newIndex, reason)
    private var onPlaybackError: ((PlaybackException) -> Unit)? = null
    private var onPlaybackStateChanged: ((Boolean) -> Unit)? = null  // isPlaying

    /**
     * Initialize ExoPlayer with caching data source.
     * Must be called from the main thread.
     */
    fun initialize() {
        if (exoPlayer != null) return

        // Set up disk cache with LRU eviction
        val cacheDir = File(context.cacheDir, CACHE_DIR_NAME)
        cache = SimpleCache(
            cacheDir,
            LeastRecentlyUsedCacheEvictor(MAX_CACHE_BYTES)
        )

        // OkHttp data source for network requests (shares interceptors with Retrofit)
        val okHttpDataSourceFactory = OkHttpDataSource.Factory(okHttpClient)

        // Cache data source wraps OkHttp — serves from cache when available
        val cacheDataSourceFactory = CacheDataSource.Factory()
            .setCache(cache!!)
            .setUpstreamDataSourceFactory(okHttpDataSourceFactory)
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)

        // Renderers factory with decoder fallback enabled.
        // On FireStick / MTK / Amlogic SoCs, hardware AVC decoders sometimes fail to
        // initialize for certain profiles (e.g. avc1.4D401F). With fallback enabled
        // ExoPlayer automatically retries with a software decoder instead of erroring.
        val renderersFactory = DefaultRenderersFactory(context)
            .setEnableDecoderFallback(true)
            .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER)

        exoPlayer = ExoPlayer.Builder(context)
            .setRenderersFactory(renderersFactory)
            .setMediaSourceFactory(DefaultMediaSourceFactory(cacheDataSourceFactory))
            .build()
            .apply {
                // Loop the entire playlist endlessly
                repeatMode = Player.REPEAT_MODE_ALL

                addListener(object : Player.Listener {
                    override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                        val newIndex = currentMediaItemIndex
                        val previousIndex = if (newIndex > 0) newIndex - 1 else mediaItemCount - 1
                        Log.d(TAG, "Item transition: $previousIndex -> $newIndex (reason=$reason)")
                        onItemTransition?.invoke(previousIndex, newIndex, reason)
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        Log.e(TAG, "Playback error: ${error.message}", error)
                        onPlaybackError?.invoke(error)
                    }

                    override fun onPlaybackStateChanged(playbackState: Int) {
                        when (playbackState) {
                            Player.STATE_READY -> {
                                Log.d(TAG, "Player ready")
                                // Notify when playback is ready and playing
                                if (isPlaying) {
                                    onPlaybackStateChanged?.invoke(true)
                                }
                            }
                            Player.STATE_BUFFERING -> Log.d(TAG, "Buffering...")
                            Player.STATE_ENDED -> Log.d(TAG, "Playback ended")
                            Player.STATE_IDLE -> Log.d(TAG, "Player idle")
                        }
                    }

                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        Log.d(TAG, "isPlaying changed: $isPlaying")
                        onPlaybackStateChanged?.invoke(isPlaying)
                    }
                })
            }
    }

    /**
     * Load a new playlist into the player. Replaces existing items.
     * Starts playing immediately.
     */
    fun loadPlaylist(videoUrls: List<String>) {
        val player = exoPlayer ?: run {
            Log.e(TAG, "Player not initialized")
            return
        }

        val mediaItems = videoUrls.map { url ->
            MediaItem.fromUri(url)
        }

        player.setMediaItems(mediaItems)
        player.prepare()
        player.play()
        Log.i(TAG, "Loaded ${mediaItems.size} items into playlist")
    }

    /**
     * Set listener for item transitions (used for impression recording).
     * Called with (previousIndex, newIndex) when one video ends and next begins.
     */
    fun setOnItemTransition(listener: (Int, Int, Int) -> Unit) {
        onItemTransition = listener
    }

    /**
     * Set listener for playback errors.
     */
    fun setOnPlaybackError(listener: (PlaybackException) -> Unit) {
        onPlaybackError = listener
    }

    /**
     * Set listener for playback state changes (playing/paused).
     * Used to hide loading overlay when playback starts.
     */
    fun setOnPlaybackStateChanged(listener: (Boolean) -> Unit) {
        onPlaybackStateChanged = listener
    }

    /**
     * Pause playback (e.g., outside operating hours).
     */
    fun pause() {
        exoPlayer?.pause()
    }

    /**
     * Resume playback.
     */
    fun resume() {
        exoPlayer?.play()
    }

    /**
     * Get the ExoPlayer instance (for binding to PlayerView in UI).
     */
    fun getPlayer(): ExoPlayer? = exoPlayer

    /**
     * Whether the player is currently playing.
     */
    val isPlaying: Boolean
        get() = exoPlayer?.isPlaying == true

    /**
     * Current playlist item index.
     */
    val currentIndex: Int
        get() = exoPlayer?.currentMediaItemIndex ?: -1

    /**
     * Total items in playlist.
     */
    val itemCount: Int
        get() = exoPlayer?.mediaItemCount ?: 0

    /**
     * Release player and cache resources.
     */
    fun release() {
        exoPlayer?.release()
        exoPlayer = null
        cache?.release()
        cache = null
        Log.i(TAG, "Player released")
    }

    /**
     * Pre-cache video URLs into the local disk cache in the background.
     *
     * Called before a playlist swap to ensure seamless transition.
     * Uses CacheWriter to download files into the same SimpleCache that
     * ExoPlayer reads from — no double storage. If a URL is already
     * cached, CacheWriter returns immediately.
     */
    suspend fun preCacheUrls(urls: List<String>) = withContext(Dispatchers.IO) {
        val currentCache = cache ?: run {
            Log.w(TAG, "Cache not initialized, skipping pre-cache")
            return@withContext
        }
        val upstreamFactory = OkHttpDataSource.Factory(okHttpClient)

        Log.i(TAG, "Pre-caching ${urls.size} URLs...")
        for (url in urls) {
            try {
                val dataSpec = DataSpec(Uri.parse(url))
                val dataSource = CacheDataSource(
                    currentCache,
                    upstreamFactory.createDataSource(),
                    CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR
                )
                val writer = CacheWriter(dataSource, dataSpec, null, null)
                writer.cache()
                Log.d(TAG, "Pre-cached: ${url.substringAfterLast("/")}")
            } catch (e: Exception) {
                Log.w(TAG, "Pre-cache failed for ${url.substringAfterLast("/")}: ${e.message}")
            }
        }
        Log.i(TAG, "Pre-cache complete for ${urls.size} URLs")
    }

    /**
     * Evict specific URLs from the disk cache.
     *
     * Called when content is removed server-side so stale videos don't linger.
     * Matches Pi player behaviour: `_clear_slot_cache(slot_number)` removes
     * cached files for a slot before refreshing.
     * SimpleCache keys match the URI string by default in Media3.
     */
    fun evictCachedUrls(urls: List<String>) {
        val currentCache = cache ?: run {
            Log.w(TAG, "Cache not initialized, skipping eviction")
            return
        }
        for (url in urls) {
            try {
                // SimpleCache key defaults to the content URI
                val cacheKey = url
                currentCache.removeResource(cacheKey)
                Log.d(TAG, "Evicted cache: ${url.substringAfterLast("/")}")
            } catch (e: Exception) {
                Log.w(TAG, "Cache eviction failed for ${url.substringAfterLast("/")}: ${e.message}")
            }
        }
        Log.i(TAG, "Evicted ${urls.size} cached URLs")
    }
}
