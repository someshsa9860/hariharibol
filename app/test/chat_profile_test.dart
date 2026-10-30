// What Sakha has noticed about the reader, as the app reads it from the server:
// the shape the server sends, and that a different account never sees the last
// one's profile. The chat page does not show it to the reader; the server still
// keeps and learns it, so the app keeps reading it.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/models/app_user.dart';
import 'package:hariharibol/models/sakha_profile.dart';
import 'package:hariharibol/providers/chat_provider.dart';
import 'package:hariharibol/providers/sakha_profile_provider.dart';
import 'package:hariharibol/providers/session_provider.dart';

import 'support/fake_chat_service.dart';

const _noted = SakhaProfile(
  fields: {
    SakhaTrait.gender: 'male',
    SakhaTrait.age: 'in his fifties',
    SakhaTrait.behaviour: 'thoughtful and patient',
    SakhaTrait.lifeStage: 'a retired teacher',
    SakhaTrait.spiritualStage: 'a sincere beginner',
    SakhaTrait.communication: 'short, plain answers',
  },
  notes: ['Chants sixteen rounds a day'],
  keywords: ['dharma', 'anger', 'gita'],
);

final _asha = AppUser.fromJson({'id': 'usr_1', 'email': 'asha42@smoke.test', 'name': 'Asha Devi'});
final _ravi = AppUser.fromJson({'id': 'usr_2', 'email': 'ravi7@smoke.test', 'name': 'Ravi Das'});

void main() {
  late FakeChatService fake;

  setUp(() => fake = FakeChatService());

  group('the profile', () {
    test('is read as the server sends it, and is empty when the server sends nothing', () {
      final nothing = SakhaProfile.fromJson(const {});
      expect(nothing.learning, isTrue);
      expect(nothing.isEmpty, isTrue);
      expect(nothing.updatedAt, isNull);

      final profile = SakhaProfile.fromJson({
        'learning': false,
        'traits': {
          // Not in the order the app lists them, and one empty: an empty value is no value.
          'communication': 'short and warm',
          'age': 'in their thirties',
          'gender': '',
          'notes': ['Chants every morning', 'Asks about the Gita'],
        },
        'keywords': ['dharma', 'anger'],
        'updatedAt': '2026-10-22T04:30:00.000Z',
      });

      expect(profile.learning, isFalse);
      expect(profile.isEmpty, isFalse);
      expect(profile.fields.keys, [SakhaTrait.age, SakhaTrait.communication]);
      expect(profile.fields[SakhaTrait.age], 'in their thirties');
      expect(profile.notes, ['Chants every morning', 'Asks about the Gita']);
      expect(profile.keywords, ['dharma', 'anger']);
      expect(profile.updatedAt?.toUtc(), DateTime.utc(2026, 10, 22, 4, 30));

      // Switching the noticing back on changes that and nothing else.
      final on = profile.copyWith(learning: true);
      expect(on.learning, isTrue);
      expect(on.fields, profile.fields);
      expect(on.notes, profile.notes);
      expect(on.keywords, profile.keywords);
    });

    test('is read again when a different account signs in, never kept for the next one', () async {
      final container = ProviderContainer(overrides: [
        chatServiceProvider.overrideWithValue(fake),
        currentUserProvider.overrideWith(() => _SwitchableUser(_asha)),
      ]);
      addTearDown(container.dispose);
      fake.profileValue = _noted;
      container.listen(sakhaProfileProvider, (_, _) {});
      final reader = container.read(currentUserProvider.notifier) as _SwitchableUser;

      expect((await container.read(sakhaProfileProvider.future)).fields, isNotEmpty);

      fake.profileValue = const SakhaProfile();
      reader.become(_ravi);
      expect((await container.read(sakhaProfileProvider.future)).isEmpty, isTrue);
      expect(fake.calls.where((call) => call == 'profile'), hasLength(2));
    });
  });
}

/// A reader who can change, as when one account signs out and another signs in.
class _SwitchableUser extends CurrentUser {
  _SwitchableUser(this._first);

  final AppUser? _first;

  @override
  AppUser? build() => _first;

  void become(AppUser? user) => state = user;
}
