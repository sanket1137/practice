plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.dagger.hilt.android")
    id("com.google.devtools.ksp")
}

android {
    namespace = "com.pixelspot.ccms.player"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.pixelspot.ccms.player"
        minSdk = 24          // Android 7.0 — broad Android TV coverage
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Room schema export for migration testing
        ksp {
            arg("room.schemaLocation", "$projectDir/schemas")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
    }
}

dependencies {

    // ── Core Android ──
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.activity:activity-ktx:1.8.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-service:2.7.0")

    // ── ExoPlayer (Media3) — Video playback ──
    val media3Version = "1.2.1"
    implementation("androidx.media3:media3-exoplayer:$media3Version")
    implementation("androidx.media3:media3-exoplayer-hls:$media3Version")
    implementation("androidx.media3:media3-datasource-okhttp:$media3Version")
    implementation("androidx.media3:media3-ui:$media3Version")

    // ── Room — Local SQLite for impressions (replaces Pi's raw SQLite) ──
    val roomVersion = "2.6.1"
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    ksp("androidx.room:room-compiler:$roomVersion")

    // ── Retrofit + OkHttp — REST API (handshake, sync, heartbeat) ──
    val retrofitVersion = "2.9.0"
    implementation("com.squareup.retrofit2:retrofit:$retrofitVersion")
    implementation("com.squareup.retrofit2:converter-gson:$retrofitVersion")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // ── SignalR — Real-time events from backend ──
    implementation("com.microsoft.signalr:signalr:7.0.14")

    // ── WebRTC — Live streaming from player to dashboard viewers ──
    // Using stream-webrtc-android from JitPack (Google's WebRTC is not on Maven Central)
    implementation("io.getstream:stream-webrtc-android:1.1.1")

    // ── Hilt — Dependency injection ──
    val hiltVersion = "2.50"
    implementation("com.google.dagger:hilt-android:$hiltVersion")
    ksp("com.google.dagger:hilt-android-compiler:$hiltVersion")

    // ── DataStore — Encrypted config storage ──
    implementation("androidx.datastore:datastore-preferences:1.0.0")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // ── WorkManager — Fallback periodic sync if foreground service killed ──
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    implementation("androidx.hilt:hilt-work:1.1.0")
    ksp("androidx.hilt:hilt-compiler:1.1.0")

    // ── Coroutines ──
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // ── Gson — JSON serialization ──
    implementation("com.google.code.gson:gson:2.10.1")

    // ── Leanback — Android TV UI (optional, for setup screen) ──
    implementation("androidx.leanback:leanback:1.0.0")

    // ── ZXing — QR code generation for screen verification ──
    implementation("com.google.zxing:core:3.5.3")

    // ── Testing ──
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
    testImplementation("androidx.room:room-testing:$roomVersion")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test:runner:1.5.2")
}
