package com.pixelspot.ccms.player.di

import android.content.Context
import androidx.room.Room
import com.pixelspot.ccms.player.data.local.AppDatabase
import com.pixelspot.ccms.player.data.local.ImpressionDao
import com.pixelspot.ccms.player.data.local.SyncHistoryDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Hilt module providing app-wide singletons: Room database, DAOs.
 */
@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            AppDatabase.DATABASE_NAME
        )
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides
    fun provideImpressionDao(db: AppDatabase): ImpressionDao = db.impressionDao()

    @Provides
    fun provideSyncHistoryDao(db: AppDatabase): SyncHistoryDao = db.syncHistoryDao()
}
