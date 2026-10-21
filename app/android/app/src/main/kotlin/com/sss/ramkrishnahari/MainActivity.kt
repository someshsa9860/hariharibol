package com.sss.ramkrishnahari

import android.app.UiModeManager
import android.content.res.Configuration
import com.ryanheise.audioservice.AudioServiceActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

// AudioServiceActivity (not FlutterActivity) so the audio_service plugin can
// share this activity's Flutter engine for lock-screen controls.
class MainActivity : AudioServiceActivity() {
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
    }
}
