# Keep all classes with native methods (JNI bridge from Rust)
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep all Tauri-generated classes used via JNI/reflection
-keep class com.inarimarket.app.** { *; }

# Keep Tauri plugin classes loaded at runtime
-keep class app.tauri.** { *; }

# Keep Lifecycle/Activity classes used by Tauri
-keep class androidx.lifecycle.** { *; }
-keep class androidx.activity.** { *; }

# Keep AndroidX WebKit used by Tauri WebView
-keep class androidx.webkit.** { *; }

# Keep Material theme attributes used by the activity theme
-keep class com.google.android.material.** { *; }

# Keep ConstraintLayout used by activity_main.xml
-keep class androidx.constraintlayout.** { *; }

# Preserve line numbers for crash stack traces
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
