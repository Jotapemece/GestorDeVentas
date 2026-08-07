package com.gestorventas.downloads

import android.app.Activity
import android.content.ContentValues
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import androidx.core.content.ContextCompat
import java.io.File
import java.io.FileOutputStream
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.PermissionCallback
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class SaveArgs {
    lateinit var file_name: String
    lateinit var content: String
}

@TauriPlugin(
    permissions = [
        app.tauri.annotation.Permission(
            alias = "storage",
            strings = ["android.permission.WRITE_EXTERNAL_STORAGE"]
        )
    ]
)
class ExamplePlugin(private val activity: Activity) : Plugin(activity) {

    @Command
    fun saveToDownloads(invoke: Invoke) {
        Thread {
            try {
                val args = invoke.parseArgs(SaveArgs::class.java)
                if (needsStoragePermission()) {
                    // Android < 10 y sin permiso concedido: solicitarlo vía Tauri.
                    requestPermissionForAliases(arrayOf("storage"), invoke, "saveToDownloadsPermissionCallback")
                    return@Thread
                }
                val bytes = decodeBase64(args.content)
                val name = sanitizeFileName(args.file_name)
                val path = writeToDownloads(activity, name, bytes)
                invoke.resolve(JSObject().put("path", path))
            } catch (e: Exception) {
                invoke.reject(e.message ?: "Error al guardar en Descargas")
            }
        }.start()
    }

    // Llamado por el framework tras conceder/negar el permiso.
    @PermissionCallback
    fun saveToDownloadsPermissionCallback(invoke: Invoke) {
        Thread {
            val args = invoke.parseArgs(SaveArgs::class.java)
            if (!needsStoragePermission()) {
                try {
                    val name = sanitizeFileName(args.file_name)
                    val path = writeToDownloads(activity, name, decodeBase64(args.content))
                    invoke.resolve(JSObject().put("path", path))
                } catch (e: Exception) {
                    invoke.reject(e.message ?: "Error al guardar en Descargas")
                }
            } else {
                invoke.reject("Permiso de almacenamiento no concedido")
            }
        }.start()
    }

    private fun needsStoragePermission(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(
                activity,
                "android.permission.WRITE_EXTERNAL_STORAGE"
            ) != PackageManager.PERMISSION_GRANTED

    private fun writeToDownloads(activity: Activity, name: String, data: ByteArray): String {
        val resolver = activity.contentResolver
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10+: MediaStore.Downloads (scoped storage) — no permissions required
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name)
                put(MediaStore.Downloads.MIME_TYPE, mimeFor(name))
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
            val uri: Uri = resolver.insert(collection, values)
                ?: throw Exception("No se pudo crear el archivo en Descargas")
            try {
                resolver.openOutputStream(uri)?.use { it.write(data) }
                    ?: throw Exception("No se pudo escribir el archivo")
                values.clear()
                values.put(MediaStore.Downloads.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
            } catch (e: Exception) {
                resolver.delete(uri, null, null)
                throw e
            }
            uri.toString()
        } else {
            // Android < 10: write directly to the public Downloads directory
            val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            val file = File(dir, name)
            FileOutputStream(file).use { it.write(data) }
            file.absolutePath
        }
    }

    private fun decodeBase64(s: String): ByteArray =
        Base64.decode(s, Base64.DEFAULT)

    private fun sanitizeFileName(name: String): String {
        val cleaned = name.replace(Regex("[\\\\/:*?\"<>|]"), "_").trim()
        return if (cleaned.isEmpty()) "archivo" else cleaned
    }

    private fun mimeFor(name: String): String = when (name.substringAfterLast('.', "").lowercase()) {
        "pdf" -> "application/pdf"
        "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        "enc" -> "application/octet-stream"
        "db" -> "application/octet-stream"
        "png" -> "image/png"
        "txt" -> "text/plain"
        "csv" -> "text/csv"
        "json" -> "application/json"
        else -> "application/octet-stream"
    }
}