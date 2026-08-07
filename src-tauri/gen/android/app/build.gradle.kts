import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

// Credenciales de firma: NUNCA hardcodear passwords en el repo.
// Se leen de keystore.properties (debe estar en .gitignore) o de variables de entorno.
fun signingPassword(key: String, env: String, keystoreProps: Properties): String? {
    keystoreProps.getProperty(key)?.let { if (it.isNotBlank()) return it }
    return System.getenv(env)?.takeIf { it.isNotBlank() }
}

val ksPropsFile = file("keystore.properties")
val ksProps = Properties().apply {
    if (ksPropsFile.exists()) ksPropsFile.inputStream().use { load(it) }
}
val storePwd = signingPassword("storePassword", "ANDROID_KEYSTORE_PASSWORD", ksProps)
val keyPwd = signingPassword("keyPassword", "ANDROID_KEY_PASSWORD", ksProps)
val keyAlias = signingPassword("keyAlias", "ANDROID_KEY_ALIAS", ksProps) ?: "gestor-ventas"

android {
    signingConfigs {
        create("release") {
            storeFile = file("../../../release-key.keystore")
            storePassword = storePwd
            keyAlias = keyAlias
            keyPassword = keyPwd
        }
    }
    compileSdk = 36
    namespace = "com.gestor_ventas.app"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "com.gestor_ventas.app"
        minSdk = 24
        targetSdk = 34
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    packaging {
        jniLibs.excludes += listOf(
            "lib/armeabi-v7a/*.so",
            "lib/x86/*.so",
            "lib/x86_64/*.so"
        )
        jniLibs.useLegacyPackaging = false
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
        }
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        buildConfig = true
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")