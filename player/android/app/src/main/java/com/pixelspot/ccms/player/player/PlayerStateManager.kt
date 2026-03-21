package com.pixelspot.ccms.player.player

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Centralized state manager for player status.
 * Allows the service to emit states and UI to observe them.
 */
@Singleton
class PlayerStateManager @Inject constructor() {

    private val _state = MutableStateFlow<PlayerState>(PlayerState.Initializing)
    val state: StateFlow<PlayerState> = _state.asStateFlow()

    fun setState(newState: PlayerState) {
        _state.value = newState
    }

    fun setConnecting(message: String = "Connecting to server...") {
        _state.value = PlayerState.Connecting(message)
    }

    fun setLoadingPlaylist(message: String = "Loading playlist...") {
        _state.value = PlayerState.LoadingPlaylist(message)
    }

    fun setDownloading(current: Int, total: Int) {
        _state.value = PlayerState.Downloading(current, total)
    }

    fun setPlaying(itemCount: Int) {
        _state.value = PlayerState.Playing(itemCount)
    }

    fun setPaused(reason: String) {
        _state.value = PlayerState.Paused(reason)
    }

    fun setError(message: String, retryInSeconds: Int = 0) {
        _state.value = PlayerState.Error(message, retryInSeconds)
    }

    fun setNoContent() {
        _state.value = PlayerState.NoContent
    }
}

