package com.sss.ramkrishnahari

import com.ryanheise.audioservice.AudioServiceActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.io.FileNotFoundException

// AudioServiceActivity (not FlutterActivity) so the audio_service plugin can
// share this activity's Flutter engine for lock-screen controls.
class MainActivity : AudioServiceActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // A debug build can carry the auto-count recogniser in its assets
        // (tool/fetch_auto_chant_model.sh). Dart asks for a file by name and a
        // place to put it; false means this build does not carry it. The names
        // here repeat AutoChantConfig.bundledModelChannel / bundledModelAssetFolder.
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.sss.ramkrishnahari/bundled_model")
            .setMethodCallHandler { call, result ->
                val name = call.argument<String>("name")
                val destination = call.argument<String>("destination")
                if (call.method != "copy" || name == null || destination == null) {
                    result.notImplemented()
                    return@setMethodCallHandler
                }
                // 365 MB: off the main thread, in 1 MB pieces, never held whole in memory.
                Thread {
                    try {
                        val input = try {
                            assets.open("auto_chant/$name")
                        } catch (_: FileNotFoundException) {
                            null
                        }
                        if (input == null) {
                            runOnUiThread { result.success(false) }
                        } else {
                            input.use { source ->
                                File(destination).outputStream().use { sink -> source.copyTo(sink, 1 shl 20) }
                            }
                            runOnUiThread { result.success(true) }
                        }
                    } catch (error: Exception) {
                        runOnUiThread { result.error("copy_failed", error.message, null) }
                    }
                }.start()
            }
    }
}
