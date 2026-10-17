// The Jap tab with no connection: the mantras and today's screen as the phone
// last saved them, shown first and replaced when the network answers. The real
// local store is used; nothing here reaches a network.

import 'dart:async';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/storage_keys.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/routine_task.dart';
import 'package:hariharibol/models/sadhana.dart';
import 'package:hariharibol/providers/mantra_provider.dart';
import 'package:hariharibol/providers/sadhana_provider.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hariharibol/services/mantra_service.dart';
import 'package:hariharibol/services/sadhana_service.dart';

Map<String, dynamic> mantraJson(String slug, {String? category, String name = 'A mantra'}) => {
      'id': 'id-$slug',
      'slug': slug,
      'name': name,
      'text': 'text of $slug',
      'category': category,
    };

Map<String, dynamic> todayJson(String date, {int rounds = 5, int streak = 3}) => {
      'date': date,
      'day': {'roundTarget': 16, 'roundsCompleted': rounds, 'tasksTotal': 2, 'tasksDone': 1},
      'tasks': [
        {'id': 't1', 'title': 'Read', 'status': 'DONE'},
      ],
      'sessions': [
        {'id': 's1', 'source': 'IN_APP', 'rounds': rounds, 'beads': 0, 'startedAt': '${date}T05:00:00Z'},
      ],
      'streak': streak,
      'beadsPerRound': 108,
      'profile': {'dailyRoundTarget': 21},
      'favoriteMantra': {'slug': 'hare-krishna', 'name': 'Hare Krishna'},
    };

String dayKey(DateTime day) => routineDayKey(day);

SadhanaToday today(String date, {int rounds = 5, int streak = 3}) =>
    SadhanaToday.fromJson(todayJson(date, rounds: rounds, streak: streak));

/// A notifier with no network: [saved] is what the phone kept, [answers] is
/// what the server says each time it is asked (a failure when it is not a
/// screen).
class _Notifier extends SadhanaTodayNotifier {
  _Notifier({this.saved, required this.answers});

  final SadhanaToday? saved;
  final List<Object> answers;
  int asked = 0;

  /// While set, the server has not answered yet.
  Completer<void>? gate;

  @override
  SadhanaToday? savedCopy() => saved;

  @override
  Future<SadhanaToday> fetch() async {
    await gate?.future;
    final answer = answers[asked < answers.length ? asked : answers.length - 1];
    asked++;
    if (answer is SadhanaToday) return answer;
    throw answer;
  }
}

final offline = ApiFailure(kind: FailureKind.network);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory dir;

  setUpAll(() async {
    dir = await Directory.systemTemp.createTemp('hariharibol_jap_offline');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (call) async => dir.path,
    );
    await LocalStore.instance.init();
  });

  tearDownAll(() {
    if (dir.existsSync()) dir.deleteSync(recursive: true);
  });

  setUp(() => LocalStore.instance.clear());

  group('what is saved', () {
    test('everything the Jap tab keeps is under the prefix sign-out removes', () {
      for (final key in [
        BoxKeys.sadhanaToday,
        BoxKeys.mantraCategories,
        BoxKeys.mantraList(null),
        BoxKeys.mantraList('beej'),
        BoxKeys.mantraDetail('om'),
      ]) {
        expect(key.startsWith(BoxKeys.sadhanaCachePrefix), isTrue, reason: key);
      }
      for (final key in [
        BoxKeys.mantraCategories,
        BoxKeys.mantraList(null),
        BoxKeys.mantraList('beej'),
        BoxKeys.mantraDetail('om'),
      ]) {
        expect(key.startsWith(BoxKeys.mantraCachePrefix), isTrue, reason: key);
      }
    });

    test('deleteWithPrefix removes that family and nothing else', () async {
      final store = LocalStore.instance;
      await store.write(BoxKeys.mantraList(null), [mantraJson('om')]);
      await store.write(BoxKeys.mantraDetail('om'), mantraJson('om'));
      await store.write(BoxKeys.sadhanaToday, todayJson('2026-10-16'));
      await store.write(BoxKeys.themeMode, 'dark');

      await store.deleteWithPrefix(BoxKeys.mantraCachePrefix);

      expect(store.read<Object>(BoxKeys.mantraList(null)), isNull);
      expect(store.read<Object>(BoxKeys.mantraDetail('om')), isNull);
      expect(store.read<Object>(BoxKeys.sadhanaToday), isNotNull);
      expect(store.read<String>(BoxKeys.themeMode), 'dark');

      await store.deleteWithPrefix(BoxKeys.sadhanaCachePrefix);
      expect(store.read<Object>(BoxKeys.sadhanaToday), isNull);
      expect(store.read<String>(BoxKeys.themeMode), 'dark');
    });
  });

  group('saved mantras', () {
    final service = MantraService.instance;

    test('nothing saved gives null, not an empty list', () {
      expect(service.savedList(), isNull);
      expect(service.savedList(category: 'beej'), isNull);
      expect(service.savedCategories(), isNull);
      expect(service.savedMantra('om'), isNull);
    });

    test('the list and the categories come back as they were saved', () async {
      await LocalStore.instance.write(BoxKeys.mantraList(null), [
        mantraJson('om', category: 'beej'),
        mantraJson('hare-krishna', category: 'mahamantra'),
      ]);
      await LocalStore.instance.write(BoxKeys.mantraCategories, [
        {'category': 'beej', 'count': 1},
        {'category': 'mahamantra', 'count': 1},
      ]);

      expect(service.savedList()!.map((m) => m.slug), ['om', 'hare-krishna']);
      expect(service.savedCategories()!.map((c) => c.slug), ['beej', 'mahamantra']);
    });

    test('a category not opened yet is cut from the full list', () async {
      await LocalStore.instance.write(BoxKeys.mantraList(null), [
        mantraJson('om', category: 'beej'),
        mantraJson('hare-krishna', category: 'mahamantra'),
        mantraJson('klim', category: 'beej'),
      ]);

      expect(service.savedList(category: 'beej')!.map((m) => m.slug), ['om', 'klim']);
      expect(service.savedList(category: 'gayatri'), isEmpty);
    });

    test('a category that was opened has its own list', () async {
      await LocalStore.instance.write(BoxKeys.mantraList(null), [
        mantraJson('om', category: 'beej'),
        mantraJson('klim', category: 'beej'),
      ]);
      await LocalStore.instance.write(BoxKeys.mantraList('beej'), [mantraJson('om', category: 'beej')]);

      expect(service.savedList(category: 'beej')!.map((m) => m.slug), ['om']);
    });

    test('a category has nothing without the full list to cut it from', () async {
      await LocalStore.instance.write(BoxKeys.mantraList('beej'), [mantraJson('om', category: 'beej')]);

      expect(service.savedList(category: 'mahamantra'), isNull);
    });

    test("a mantra's own page wins; failing that its place in the full list", () async {
      await LocalStore.instance.write(BoxKeys.mantraList(null), [
        mantraJson('om', name: 'From the list'),
        mantraJson('klim', name: 'Only in the list'),
      ]);
      await LocalStore.instance.write(
        BoxKeys.mantraDetail('om'),
        {...mantraJson('om', name: 'From its page'), 'myRounds': 12},
      );

      final page = service.savedMantra('om')!;
      expect(page.name, 'From its page');
      expect(page.myRounds, 12);
      expect(service.savedMantra('klim')!.name, 'Only in the list');
      expect(service.savedMantra('missing'), isNull);
    });

    test('a copy that cannot be read is no copy, and does not throw', () async {
      await LocalStore.instance.write(BoxKeys.mantraList(null), 'not a list');
      await LocalStore.instance.write(BoxKeys.mantraCategories, 7);
      await LocalStore.instance.write(BoxKeys.mantraDetail('om'), [1, 2]);

      expect(service.savedList(), isNull);
      expect(service.savedCategories(), isNull);
      expect(service.savedMantra('om'), isNull);
    });
  });

  group('saved, then fresh', () {
    test('the saved copy first, then the answer', () async {
      final seen = savedThenFresh<String>(() => 'saved', () async => 'fresh');
      expect(await seen.toList(), ['saved', 'fresh']);
    });

    test('a failed request leaves the saved copy standing', () async {
      final seen = savedThenFresh<String>(() => 'saved', () async => throw offline);
      expect(await seen.toList(), ['saved']);
    });

    test('with nothing saved the answer is all there is — or the failure', () async {
      expect(await savedThenFresh<String>(() => null, () async => 'fresh').toList(), ['fresh']);
      await expectLater(
        savedThenFresh<String>(() => null, () async => throw offline).toList(),
        throwsA(same(offline)),
      );
    });

    test('the request is made before the saved copy is handed over', () async {
      var asked = false;
      final seen = savedThenFresh<String>(() => 'saved', () async {
        asked = true;
        return 'fresh';
      });

      // A reader that takes the first value and lets go still got the cache
      // refreshed.
      expect(await seen.first, 'saved');
      expect(asked, isTrue);
    });

    test('a request that fails after the reader let go is not an unhandled error', () async {
      final failing = Completer<String>();
      final seen = savedThenFresh<String>(() => 'saved', () => failing.future);

      expect(await seen.first, 'saved');
      failing.completeError(offline);
      await Future<void>.delayed(Duration.zero);
    });
  });

  group('the day carried forward', () {
    test('the same day is the same screen', () {
      final saved = today('2026-10-16');
      expect(identical(saved.carriedTo('2026-10-16'), saved), isTrue);
    });

    test("yesterday's rounds are not today's", () {
      final next = today('2026-10-15', rounds: 9).carriedTo('2026-10-16');

      expect(next.date, '2026-10-16');
      expect(next.day.roundsCompleted, 0);
      expect(next.day.tasksTotal, 0);
      expect(next.day.tasksDone, 0);
      expect(next.tasks, isEmpty);
      expect(next.sessions, isEmpty);
    });

    test('the standing goal, the mantra and the beads per round come with it', () {
      final next = today('2026-10-15').carriedTo('2026-10-16');

      expect(next.day.roundTarget, 21);
      expect(next.beadsPerRound, 108);
      expect(next.chantMantraSlug, 'hare-krishna');
      expect(next.chantMantraName, 'Hare Krishna');
    });

    test("the run of days carries over from the day before, not from further back", () {
      expect(today('2026-10-15', streak: 4).carriedTo('2026-10-16').streak, 4);
      expect(today('2026-10-14', streak: 4).carriedTo('2026-10-16').streak, 0);
      expect(today('2026-09-30', streak: 4).carriedTo('2026-10-01').streak, 4);
    });

    test('a date it cannot read loses the run rather than guessing', () {
      expect(today('not a date', streak: 4).carriedTo('2026-10-16').streak, 0);
    });
  });

  group("today's screen, saved", () {
    final service = SadhanaService.instance;

    test('nothing saved gives null', () {
      expect(service.saved(), isNull);
    });

    test("today's copy comes back as it was", () async {
      final now = dayKey(DateTime.now());
      await LocalStore.instance.write(BoxKeys.sadhanaToday, todayJson(now, rounds: 7));

      final saved = service.saved()!;
      expect(saved.date, now);
      expect(saved.day.roundsCompleted, 7);
      expect(saved.sessions, hasLength(1));
    });

    test("an earlier day's copy comes back as an empty today", () async {
      final longAgo = dayKey(DateTime.now().subtract(const Duration(days: 5)));
      await LocalStore.instance.write(BoxKeys.sadhanaToday, todayJson(longAgo, rounds: 7));

      final saved = service.saved()!;
      expect(saved.date, dayKey(DateTime.now()));
      expect(saved.day.roundsCompleted, 0);
      expect(saved.sessions, isEmpty);
      expect(saved.streak, 0);
      expect(saved.day.roundTarget, 21);
    });

    test('a copy that cannot be read is no copy', () async {
      await LocalStore.instance.write(BoxKeys.sadhanaToday, 'garbage');
      expect(service.saved(), isNull);
    });
  });

  group('the screen, through the provider', () {
    ProviderContainer containerFor(_Notifier notifier) {
      final container = ProviderContainer(
        // Riverpod retries a provider that errors; a test wants the error itself.
        retry: (_, _) => null,
        overrides: [sadhanaTodayProvider.overrideWith(() => notifier)],
      );
      addTearDown(container.dispose);
      return container;
    }

    test('offline, the saved screen is what opens', () async {
      final notifier = _Notifier(saved: today('2026-10-16', rounds: 6), answers: [offline]);
      final container = containerFor(notifier);

      final opened = await container.read(sadhanaTodayProvider.future);
      await Future<void>.delayed(Duration.zero);

      expect(opened.day.roundsCompleted, 6);
      expect(container.read(sadhanaTodayProvider).hasError, isFalse);
      expect(container.read(sadhanaTodayProvider).value!.day.roundsCompleted, 6);
      expect(notifier.asked, 1, reason: 'it still asked');
    });

    test('online, the answer replaces the saved screen', () async {
      final notifier = _Notifier(
        saved: today('2026-10-16', rounds: 6),
        answers: [today('2026-10-16', rounds: 8)],
      )..gate = Completer<void>();
      final container = containerFor(notifier);

      expect((await container.read(sadhanaTodayProvider.future)).day.roundsCompleted, 6);

      notifier.gate!.complete();
      await Future<void>.delayed(Duration.zero);

      expect(container.read(sadhanaTodayProvider).value!.day.roundsCompleted, 8);
    });

    test('with nothing saved and no connection the screen is an error', () async {
      final container = containerFor(_Notifier(answers: [offline]));

      await expectLater(container.read(sadhanaTodayProvider.future), throwsA(same(offline)));
      expect(container.read(sadhanaTodayProvider).hasError, isTrue);
    });

    test('a refresh that fails keeps the screen and says why', () async {
      final notifier = _Notifier(saved: today('2026-10-16', rounds: 6), answers: [offline]);
      final container = containerFor(notifier);
      await container.read(sadhanaTodayProvider.future);

      final failure = await container.read(sadhanaTodayProvider.notifier).refresh();

      expect(failure, same(offline));
      expect(container.read(sadhanaTodayProvider).hasError, isFalse);
      expect(container.read(sadhanaTodayProvider).value!.day.roundsCompleted, 6);
    });

    test('a refresh that works replaces it and says nothing', () async {
      final notifier = _Notifier(
        saved: today('2026-10-16', rounds: 6),
        answers: [offline, today('2026-10-16', rounds: 9)],
      );
      final container = containerFor(notifier);
      await container.read(sadhanaTodayProvider.future);
      await Future<void>.delayed(Duration.zero);

      final failure = await container.read(sadhanaTodayProvider.notifier).refresh();

      expect(failure, isNull);
      expect(container.read(sadhanaTodayProvider).value!.day.roundsCompleted, 9);
    });

    test('retrying an empty screen that fails again stays an error', () async {
      final container = containerFor(_Notifier(answers: [offline]));
      await expectLater(container.read(sadhanaTodayProvider.future), throwsA(same(offline)));

      final failure = await container.read(sadhanaTodayProvider.notifier).refresh();

      expect(failure, same(offline));
      expect(container.read(sadhanaTodayProvider).hasError, isTrue);
    });

    test('retrying an empty screen that now works fills it', () async {
      final container = containerFor(_Notifier(answers: [offline, today('2026-10-16', rounds: 2)]));
      await expectLater(container.read(sadhanaTodayProvider.future), throwsA(same(offline)));

      final failure = await container.read(sadhanaTodayProvider.notifier).refresh();

      expect(failure, isNull);
      expect(container.read(sadhanaTodayProvider).value!.day.roundsCompleted, 2);
    });
  });
}
