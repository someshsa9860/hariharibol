import 'package:hariharibol/services/chat_image_picker.dart';
import 'package:hariharibol/services/speech_input.dart';

/// The camera and photo library, answering with whatever a test sets up.
class FakeChatImagePicker implements ChatImagePicker {
  /// The file the reader "chooses"; null is the reader backing out.
  String? next;

  /// Thrown by the next pick — [PictureAccessDenied] for a refused permission.
  Object? failure;

  final List<PictureSource> asked = [];

  @override
  Future<String?> pick(PictureSource source) async {
    asked.add(source);
    final error = failure;
    if (error != null) {
      failure = null;
      throw error;
    }
    return next;
  }
}

/// The phone's speech recognition, spoken to by hand: [hear] is the reader
/// talking, [endBy] is the phone deciding they have finished.
class FakeSpeechInput implements SpeechInput {
  SpeechStart result = SpeechStart.listening;

  /// The language each listening session asked for.
  final List<String> started = [];

  bool stopped = false;
  bool cancelled = false;

  /// How listening ends when the reader presses stop. A phone that heard
  /// nothing says so even then, which is what [SpeechEnd.heardNothing] sets up.
  SpeechEnd endOnStop = SpeechEnd.heard;

  void Function(String words)? _onWords;
  void Function(SpeechEnd end)? _onEnd;

  bool get listening => _onEnd != null;

  @override
  Future<SpeechStart> start({
    required String languageCode,
    required void Function(String words) onWords,
    required void Function(SpeechEnd end) onEnd,
  }) async {
    started.add(languageCode);
    if (result == SpeechStart.listening) {
      _onWords = onWords;
      _onEnd = onEnd;
    }
    return result;
  }

  void hear(String words) => _onWords?.call(words);

  void endBy(SpeechEnd end) {
    final onEnd = _onEnd;
    _onWords = null;
    _onEnd = null;
    onEnd?.call(end);
  }

  @override
  Future<void> stop() async {
    stopped = true;
    endBy(endOnStop);
  }

  @override
  Future<void> cancel() async {
    cancelled = true;
    _onWords = null;
    _onEnd = null;
  }
}
