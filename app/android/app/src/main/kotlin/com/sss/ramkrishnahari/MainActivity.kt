package com.sss.ramkrishnahari

import com.ryanheise.audioservice.AudioServiceActivity

// AudioServiceActivity (not FlutterActivity) so the audio_service plugin can
// share this activity's Flutter engine for lock-screen controls.
class MainActivity : AudioServiceActivity()
