import 'package:speech_to_text/speech_recognition_error.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';

import '../core/constants/chat_config.dart';

/// What came of asking the phone to listen.
enum SpeechStart {
  /// The microphone is open; words follow.
  listening,

  /// The reader refused the microphone or speech recognition.
  denied,

  /// This phone has no recogniser to ask, or it is switched off.
  unavailable,
}

/// Why listening ended without the reader pressing the button.
enum SpeechEnd {
  /// Words were heard, then the reader fell quiet or the time ran out.
  heard,

  /// Nothing that could be written down was said.
  heardNothing,

  /// The recogniser gave up part-way.
  failed,
}

/// Turns what the reader says into text, using the speech recognition that is
/// already on the phone — Google's on Android, Apple's on iOS. Nothing here is
/// sent to Sakha's servers; the words reach Sakha only when they are sent as a
/// message. A class behind a provider so a test can speak without a microphone.
abstract class SpeechInput {
  /// Starts listening in the phone's recogniser for [languageCode]. [onWords]
  /// is called with everything heard so far — again and again as it firms up,
  /// not just the new part — and [onEnd] once, when listening stops by itself.
  Future<SpeechStart> start({
    required String languageCode,
    required void Function(String words) onWords,
    required void Function(SpeechEnd end) onEnd,
  });

  /// Stops listening and lets the last words arrive. [onEnd] still fires.
  Future<void> stop();

  /// Stops listening and drops what has not arrived. [onEnd] does not fire.
  Future<void> cancel();
}

/// The recogniser locale closest to [languageCode] out of the ids the phone
/// offers (`hi_IN`, `en-GB`…), or null to let the phone use its own.
///
/// The phone's own is kept when it is a version of the same language, since
/// that is the accent its owner has already set up; otherwise the Indian one,
/// then whichever comes first. A language the phone does not offer at all falls
/// back to the phone's own: a reader who speaks it gets a worse guess, not a
/// refusal.
String? pickSpeechLocale(
  String languageCode,
  Iterable<String> offered, {
  String? phoneDefault,
}) {
  String languageOf(String id) => id.split(RegExp('[-_]')).first.toLowerCase();
  String regionOf(String id) {
    final parts = id.split(RegExp('[-_]'));
    return parts.length > 1 ? parts[1].toUpperCase() : '';
  }

  final wanted = languageCode.toLowerCase();
  final matches = [for (final id in offered) if (languageOf(id) == wanted) id];
  if (matches.isEmpty) return null;
  if (phoneDefault != null && matches.contains(phoneDefault)) return phoneDefault;
  return matches.firstWhere(
    (id) => regionOf(id) == ChatConfig.speechRegion,
    orElse: () => matches.first,
  );
}

class DeviceSpeechInput implements SpeechInput {
  DeviceSpeechInput({SpeechToText? speech}) : _speech = speech ?? SpeechToText();

  final SpeechToText _speech;

  void Function(String words)? _onWords;
  void Function(SpeechEnd end)? _onEnd;
  bool _heard = false;

  /// The plugin keeps the first callbacks it is given, so these two are fixed
  /// and pass on to whichever listening session is current.
  Future<bool> _ready() => _speech.initialize(onError: _handleError, onStatus: _handleStatus);

  @override
  Future<SpeechStart> start({
    required String languageCode,
    required void Function(String words) onWords,
    required void Function(SpeechEnd end) onEnd,
  }) async {
    if (!await _ready()) {
      return await _speech.hasPermission ? SpeechStart.unavailable : SpeechStart.denied;
    }
    final offered = [for (final locale in await _speech.locales()) locale.localeId];
    final localeId = pickSpeechLocale(
      languageCode,
      offered,
      phoneDefault: (await _speech.systemLocale())?.localeId,
    );
    _onWords = onWords;
    _onEnd = onEnd;
    _heard = false;
    await _speech.listen(
      onResult: _handleResult,
      listenOptions: SpeechListenOptions(
        localeId: localeId,
        listenFor: ChatConfig.listenFor,
        pauseFor: ChatConfig.pauseFor,
        partialResults: true,
        cancelOnError: true,
        listenMode: ListenMode.dictation,
      ),
    );
    return SpeechStart.listening;
  }

  @override
  Future<void> stop() async {
    await _speech.stop();
    _finish(_heard ? SpeechEnd.heard : SpeechEnd.heardNothing);
  }

  @override
  Future<void> cancel() async {
    _onWords = null;
    _onEnd = null;
    await _speech.cancel();
  }

  void _handleResult(SpeechRecognitionResult result) {
    final words = result.recognizedWords.trim();
    if (words.isEmpty) return;
    _heard = true;
    _onWords?.call(words);
  }

  void _handleStatus(String status) {
    if (status == SpeechToText.doneStatus) {
      _finish(_heard ? SpeechEnd.heard : SpeechEnd.heardNothing);
    }
  }

  void _handleError(SpeechRecognitionError error) {
    switch (error.errorMsg) {
      // The phone's wording for "nobody spoke" and "nothing made sense".
      case 'error_no_match' || 'error_speech_timeout':
        _finish(_heard ? SpeechEnd.heard : SpeechEnd.heardNothing);
      default:
        _finish(SpeechEnd.failed);
    }
  }

  /// Tells the screen once, and then forgets it: a late result or a second
  /// `done` from the plugin finds nobody to tell.
  void _finish(SpeechEnd end) {
    final onEnd = _onEnd;
    _onWords = null;
    _onEnd = null;
    onEnd?.call(end);
  }
}
