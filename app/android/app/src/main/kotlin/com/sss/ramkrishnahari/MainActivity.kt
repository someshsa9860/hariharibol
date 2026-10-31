package com.sss.ramkrishnahari

import android.app.UiModeManager
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import com.ryanheise.audioservice.AudioServiceActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

// AudioServiceActivity (not FlutterActivity) so the audio_service plugin can
// share this activity's Flutter engine for lock-screen controls.
class MainActivity : AudioServiceActivity() {
    // Text selected in another app and sent to "Ask Sakha" (the AskSakhaSelection
    // alias in the manifest). Kept here until Dart takes it, because the Flutter
    // side may not be running yet when the choice is made.
    private var selectedText: String? = null
    private var selectionChannel: MethodChannel? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // A recreated activity (rotation, theme change) gets its first intent again;
        // only a fresh launch carries the selection.
        if (savedInstanceState == null) {
            selectedText = selectedTextFrom(intent)
        }
    }

    // The app was already running when "Ask Sakha" was chosen in another app.
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        selectedTextFrom(intent)?.let {
            selectedText = it
            selectionChannel?.invokeMethod("selectionChanged", null)
        }
    }

    // Tells the app whether it is on a television, where everything has to be
    // reachable with a remote's arrow keys (see core/layout/adaptive.dart).
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "hariharibol/device")
            .setMethodCallHandler { call, result ->
                if (call.method == "isTv") {
                    val ui = getSystemService(UI_MODE_SERVICE) as UiModeManager
                    result.success(ui.currentModeType == Configuration.UI_MODE_TYPE_TELEVISION)
                } else {
                    result.notImplemented()
                }
            }
        // Dart takes the held text on start, and is told when a new one arrives
        // (services/sakha_selection.dart).
        val selection = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "hariharibol/selection")
        selection.setMethodCallHandler { call, result ->
            if (call.method == "takeSelectedText") {
                result.success(selectedText)
                selectedText = null
            } else {
                result.notImplemented()
            }
        }
        selectionChannel = selection
    }

    // The text the reader selected, when this intent is the "Ask Sakha" choice.
    private fun selectedTextFrom(from: Intent?): String? {
        if (from == null || from.action != Intent.ACTION_PROCESS_TEXT) return null
        return from.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()?.takeIf { it.isNotBlank() }
    }
}
