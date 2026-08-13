package com.pixelspot.ccms.player.di

import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

/**
 * Hilt module for player-specific bindings.
 *
 * ExoPlayerManager, PlaylistManager, SignalRClient are all @Singleton with @Inject
 * constructors, so Hilt auto-provides them. This module is reserved for any
 * future bindings (e.g., interface implementations, qualifiers).
 */
@Module
@InstallIn(SingletonComponent::class)
object PlayerModule {
    // Currently empty — all player classes use constructor injection.
    // Add @Binds or @Provides here when needed for interface bindings.
}
