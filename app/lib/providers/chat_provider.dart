import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/chat.dart';
import '../services/chat_image_picker.dart';
import '../services/chat_service.dart';
import '../services/speech_input.dart';
import 'session_provider.dart';

/// The service behind the chat. A provider so a test can hand in a fake that
/// plays back a scripted stream.
final chatServiceProvider = Provider<ChatService>((ref) => ChatService.instance);

/// The camera and photo library, a provider so a test can pick without either.
final chatImagePickerProvider = Provider<ChatImagePicker>((ref) => DeviceImagePicker());

/// The phone's speech recognition. Listening stops with the provider, which is
/// what closes the microphone if the reader leaves the chat mid-sentence.
final speechInputProvider = Provider<SpeechInput>((ref) {
  final input = DeviceSpeechInput();
  ref.onDispose(input.cancel);
  return input;
});

/// Sakha's description, the credit meter and the input limits.
///
/// Kept alive and updated in place: every finished reply carries the meter's
/// new reading, so the bar moves without a second request. It is read again
/// whenever the chat opens, and whenever someone else signs in.
class ChatStatusNotifier extends AsyncNotifier<ChatStatus> {
  @override
  Future<ChatStatus> build() {
    ref.watch(currentUserProvider.select((user) => user?.id));
    return ref.watch(chatServiceProvider).status();
  }

  Future<void> refresh() async {
    final service = ref.read(chatServiceProvider);
    final next = await AsyncValue.guard(service.status);
    // A failed re-read keeps the last good meter rather than blanking the bar.
    if (!ref.mounted) return;
    if (next.hasValue || !state.hasValue) state = next;
  }

  void applyCredits(ChatCredits credits) {
    final current = state.value;
    if (current == null || !ref.mounted) return;
    state = AsyncData(current.withCredits(credits));
  }
}

final chatStatusProvider =
    AsyncNotifierProvider<ChatStatusNotifier, ChatStatus>(ChatStatusNotifier.new);
