package com.pixelspot.ccms.player.di

import com.pixelspot.ccms.player.config.PlayerConfig
import com.pixelspot.ccms.player.data.remote.PlayerApiService
import com.pixelspot.ccms.player.security.SecurityManager
import com.google.gson.Gson
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

/**
 * Hilt module providing networking: OkHttpClient, Retrofit, PlayerApiService.
 *
 * OkHttp interceptor injects HMAC-signed headers on every request.
 */
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(playerConfig: PlayerConfig): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        // Header interceptor: adds X-Screen-Id on every request
        val headerInterceptor = Interceptor { chain ->
            val original = chain.request()
            val requestBuilder = original.newBuilder()

            playerConfig.screenId?.let {
                requestBuilder.addHeader("X-Screen-Id", it)
            }

            chain.proceed(requestBuilder.build())
        }

        return OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .addInterceptor(headerInterceptor)
            .addInterceptor(logging)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient, playerConfig: PlayerConfig): Retrofit {
        val baseUrl = playerConfig.serverUrl?.trimEnd('/') ?: "https://ccms.pixelspot.in"
        return Retrofit.Builder()
            .baseUrl("$baseUrl/")
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun providePlayerApiService(retrofit: Retrofit): PlayerApiService {
        return retrofit.create(PlayerApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideGson(): Gson = Gson()
}
