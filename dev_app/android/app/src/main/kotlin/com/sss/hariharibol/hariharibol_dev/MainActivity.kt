package com.sss.hariharibol.hariharibol_dev

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createPushChannels()
    }

    /**
     * The API puts a critical push on `default` and a routine one on `updates`
     * (backend/utils/push-message.js). A channel the app has not created is replaced by Android's generic
     * fallback, so the loud/quiet difference would be lost. Creating a channel that exists is a no-op, and
     * the user's own changes to it are kept.
     */
    private fun createPushChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                "default",
                getString(R.string.channel_alerts_name),
                NotificationManager.IMPORTANCE_HIGH,
            ).apply { description = getString(R.string.channel_alerts_description) },
        )
        manager.createNotificationChannel(
            NotificationChannel(
                "updates",
                getString(R.string.channel_updates_name),
                NotificationManager.IMPORTANCE_LOW,
            ).apply { description = getString(R.string.channel_updates_description) },
        )
    }
}
