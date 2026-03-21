package com.pixelspot.ccms.player.player

/**
 * Represents the current state of the player for UI feedback.
 * Used to show appropriate loading messages and hide the overlay when playing.
 */
sealed class PlayerState {
    /** Initial state when service starts */
    object Initializing : PlayerState()

    /** Connecting to the server / performing handshake */
    data class Connecting(val message: String = "Connecting to server...") : PlayerState()

    /** Loading playlist from server */
    data class LoadingPlaylist(val message: String = "Loading playlist...") : PlayerState()

    /** Downloading/caching video files */
    data class Downloading(val current: Int, val total: Int) : PlayerState() {
        val message: String get() = "Preparing content... ($current of $total)"
    }

    /** Playback is active */
    data class Playing(val itemCount: Int) : PlayerState()

    /** Playback paused (outside operating hours) */
    data class Paused(val reason: String) : PlayerState()

    /** Error state with retry countdown */
    data class Error(val message: String, val retryInSeconds: Int = 0) : PlayerState() {
        val displayMessage: String
            get() = if (retryInSeconds > 0) "$message\nRetrying in ${retryInSeconds}s..." else message
    }

    /** No content available - showing fallback */
    object NoContent : PlayerState()

    /** Check if this state should show the loading overlay */
    val shouldShowLoadingOverlay: Boolean
        get() = when (this) {
            is Initializing, is Connecting, is LoadingPlaylist, is Downloading, is Error, is NoContent -> true
            is Playing, is Paused -> false
        }

    /** Get display message for the loading overlay */
    val loadingMessage: String
        get() = when (this) {
            is Initializing -> "Initializing player..."
            is Connecting -> message
            is LoadingPlaylist -> message
            is Downloading -> message
            is Playing -> ""
            is Paused -> reason
            is Error -> displayMessage
            is NoContent -> "No content available\nPlaying default video..."
        }
}

