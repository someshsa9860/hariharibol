import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/storage_keys.dart';
import 'package:hariharibol/models/language_settings.dart';
import 'package:hariharibol/providers/language_chain_provider.dart';
import 'package:hariharibol/providers/language_settings_provider.dart';
import 'package:hariharibol/providers/locale_provider.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('defaults', () {
    test('the stored choice wins', () {
      expect(LanguageDefaults.resolve(stored: 'ta', account: 'hi', device: 'bn'), 'ta');
    });

    test('then the account, then the device, then English', () {
      expect(LanguageDefaults.resolve(account: 'hi', device: 'bn'), 'hi');
      expect(LanguageDefaults.resolve(device: 'bn'), 'bn');
      expect(LanguageDefaults.resolve(device: ''), 'en');
    });

    test('an app language without an ARB file is skipped', () {
      expect(LanguageDefaults.resolve(device: 'bn', supported: {'en', 'hi'}), 'en');
      expect(LanguageDefaults.resolve(stored: 'ta', account: 'hi', device: 'bn', supported: {'en', 'hi'}), 'hi');
    });

    test('languageOf reads a locale name', () {
      expect(LanguageDefaults.languageOf('hi_IN'), 'hi');
      expect(LanguageDefaults.languageOf('en-US'), 'en');
      expect(LanguageDefaults.languageOf('fil'), 'fil');
      expect(LanguageDefaults.languageOf(''), 'en');
    });
  });

  group('the provider', () {
    late Directory dir;

    setUpAll(() async {
      dir = await Directory.systemTemp.createTemp('hariharibol_lang');
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
        const MethodChannel('plugins.flutter.io/path_provider'),
        (call) async => dir.path,
      );
      await LocalStore.instance.init();
    });

    tearDownAll(() async {
      await Hive.close();
      if (dir.existsSync()) dir.deleteSync(recursive: true);
    });

    setUp(() => LocalStore.instance.clear());

    ProviderContainer container() {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      return c;
    }

    test('with nothing stored, all three are a language the phone/app can use', () {
      final s = container().read(languageSettingsProvider);
      expect(s.app, isNotEmpty);
      expect(s.reading, isNotEmpty);
      expect(s.speaking, isNotEmpty);
    });

    test('changing one never changes the others', () async {
      final c = container();
      final n = c.read(languageSettingsProvider.notifier);
      await n.setApp('hi');
      await n.setReading('ta');
      await n.setSpeaking('bn');
      final before = c.read(languageSettingsProvider);
      expect((before.app, before.reading, before.speaking), ('hi', 'ta', 'bn'));

      await n.setReading('mr');
      expect(c.read(languageSettingsProvider).app, 'hi');
      expect(c.read(languageSettingsProvider).speaking, 'bn');
      await n.setSpeaking('gu');
      expect(c.read(languageSettingsProvider).reading, 'mr');
      expect(c.read(languageSettingsProvider).app, 'hi');
      await n.setApp('en');
      expect(c.read(languageSettingsProvider).reading, 'mr');
      expect(c.read(languageSettingsProvider).speaking, 'gu');
    });

    test('each is persisted and comes back after a restart', () async {
      final first = container();
      await first.read(languageSettingsProvider.notifier).setReading('te');
      await first.read(languageSettingsProvider.notifier).setSpeaking('kn');

      final second = container();
      expect(second.read(languageSettingsProvider).reading, 'te');
      expect(second.read(languageSettingsProvider).speaking, 'kn');
      expect(LocalStore.instance.read<String>(BoxKeys.languageReading), 'te');
      expect(LocalStore.instance.read<String>(BoxKeys.languageSpeaking), 'kn');
    });

    test('the reading chain follows only the reading language; speaking follows only speaking', () async {
      final c = container();
      final n = c.read(languageSettingsProvider.notifier);
      await n.setReading('hi');
      await n.setSpeaking('ta');
      expect(c.read(readingChainProvider).first, 'hi');
      expect(c.read(speakingChainProvider).first, 'ta');

      await n.setSpeaking('bn');
      expect(c.read(readingChainProvider).first, 'hi');
      expect(c.read(speakingChainProvider).first, 'bn');
      expect(c.read(speakingChainProvider).last, 'en');
    });

    test('the interface locale is the app language, and only one the app is translated into', () async {
      final c = container();
      final n = c.read(languageSettingsProvider.notifier);
      await n.setApp('en');
      expect(c.read(appLocaleProvider)?.languageCode, 'en');
      await n.setApp('bn'); // no app_bn.arb
      expect(c.read(appLocaleProvider), isNull);
      await n.setReading('bn');
      await n.setSpeaking('bn');
      expect(c.read(languageSettingsProvider).app, 'bn', reason: 'the choice is kept; the UI just stays in a shipped language');
    });

    test('adopt takes the account languages for app and reading only', () async {
      final c = container();
      final n = c.read(languageSettingsProvider.notifier);
      await n.setSpeaking('gu');
      await n.adopt(app: 'hi', reading: 'hi');
      final s = c.read(languageSettingsProvider);
      expect((s.app, s.reading, s.speaking), ('hi', 'hi', 'gu'));
    });
  });
}
