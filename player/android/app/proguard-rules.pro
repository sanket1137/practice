# ProGuard rules for CCMS Player

# ── Retrofit ──
-keepattributes Signature
-keepattributes *Annotation*
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# ── Gson ──
-keepattributes Signature
-keep class com.google.gson.** { *; }
-keep class com.pixelspot.ccms.player.data.model.** { *; }

# ── SignalR ──
-keep class com.microsoft.signalr.** { *; }

# ── Room ──
-keep class * extends androidx.room.RoomDatabase { *; }
-keep @androidx.room.Entity class * { *; }

# ── Hilt ──
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }

# ── ExoPlayer / Media3 ──
-keep class androidx.media3.** { *; }

# ── Security ──
-keep class com.pixelspot.ccms.player.security.** { *; }
