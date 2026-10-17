import 'package:flutter/widgets.dart';

import '../../services/speech_input.dart';

/// Something the reader should be told about speaking. The screen words it.
enum DictationNotice { denied, unavailable, heardNothing, failed }

/// Speaking a question into the message box, with the phone's own recogniser.
///
/// What is heard is written into the box as it firms up, after whatever was
/// already typed, and is never sent by itself: the reader reads it, changes it
/// if the phone misheard, and presses Send.
class ChatDictation extends ChangeNotifier {
  ChatDictation({required this.input, required this.text, required this.onNotice});

  final SpeechInput input;
  final TextEditingController text;
  final void Function(DictationNotice notice) onNotice;

  bool _listening = false;
  bool _stoppedByReader = false;
  bool _disposed = false;

  bool get listening => _listening;

  /// Starts listening, or stops if it already is. [languageCode] is the app's
  /// language; [maxChars] is the most the box takes.
  Future<void> toggle({required String languageCode, required int maxChars}) async {
    if (_listening) {
      _stoppedByReader = true;
      await input.stop();
      return;
    }

    final base = text.text;
    final lead = base.isEmpty || base.endsWith(' ') || base.endsWith('\n') ? base : '$base ';
    _stoppedByReader = false;

    final start = await input.start(
      languageCode: languageCode,
      onWords: (words) {
        if (_disposed) return;
        final next = '$lead$words';
        final clipped = next.length > maxChars ? next.substring(0, maxChars) : next;
        text.value = TextEditingValue(text: clipped, selection: TextSelection.collapsed(offset: clipped.length));
      },
      onEnd: _ended,
    );
    if (_disposed) return;

    switch (start) {
      case SpeechStart.listening:
        _listening = true;
        notifyListeners();
      case SpeechStart.denied:
        onNotice(DictationNotice.denied);
      case SpeechStart.unavailable:
        onNotice(DictationNotice.unavailable);
    }
  }

  void _ended(SpeechEnd end) {
    if (_disposed) return;
    _listening = false;
    notifyListeners();
    switch (end) {
      case SpeechEnd.heard:
        break;
      case SpeechEnd.heardNothing:
        // Pressing the button before saying anything is not a fault to report.
        if (!_stoppedByReader) onNotice(DictationNotice.heardNothing);
      case SpeechEnd.failed:
        onNotice(DictationNotice.failed);
    }
  }

  /// Closes the microphone without waiting for an answer — the reader sent the
  /// message, cleared the chat or left.
  Future<void> cancel() async {
    if (!_listening) return;
    _listening = false;
    notifyListeners();
    await input.cancel();
  }

  @override
  void dispose() {
    _disposed = true;
    input.cancel();
    super.dispose();
  }
}
