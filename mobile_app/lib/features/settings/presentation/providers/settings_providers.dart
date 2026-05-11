import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../../../home/presentation/providers/home_provider.dart';

const _settingsBox = 'settings';
const _themeKey = 'themeMode';
const _localeKey = 'locale';
const _notifVerseKey = 'notifVerse';
const _notifAnnouncKey = 'notifAnnounc';

// ─── Theme ────────────────────────────────────────────────────────────────────

class ThemeNotifier extends StateNotifier<ThemeMode> {
  ThemeNotifier() : super(_loadTheme());

  static ThemeMode _loadTheme() {
    try {
      final box = Hive.box(_settingsBox);
      final stored = box.get(_themeKey, defaultValue: 'system') as String;
      return _fromString(stored);
    } catch (_) {
      return ThemeMode.system;
    }
  }

  static ThemeMode _fromString(String s) {
    switch (s) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      default:
        return ThemeMode.system;
    }
  }

  Future<void> setTheme(ThemeMode mode) async {
    state = mode;
    try {
      final box = Hive.box(_settingsBox);
      await box.put(_themeKey, mode.name);
    } catch (_) {}
  }
}

// ─── Locale ───────────────────────────────────────────────────────────────────

class LocaleNotifier extends StateNotifier<Locale> {
  final Ref _ref;
  LocaleNotifier(this._ref) : super(_loadLocale());

  static Locale _loadLocale() {
    try {
      final box = Hive.box(_settingsBox);
      final stored =
          box.get(_localeKey, defaultValue: 'en') as String;
      return Locale(stored);
    } catch (_) {
      return const Locale('en');
    }
  }

  Future<void> setLocale(Locale locale) async {
    state = locale;
    // Persist locally
    try {
      final box = Hive.box(_settingsBox);
      await box.put(_localeKey, locale.languageCode);
    } catch (_) {}
    // Sync language preference to server
    try {
      final dio = _ref.read(dioProvider);
      await dio.patch(
        '/api/v1/users/me',
        data: {'languagePreference': locale.languageCode},
      );
    } catch (_) {}
  }
}

// ─── Notification Preferences ─────────────────────────────────────────────────

class NotifPrefsNotifier extends StateNotifier<Map<String, bool>> {
  final Ref _ref;
  NotifPrefsNotifier(this._ref)
      : super({
          'verse': _loadBool(_notifVerseKey, true),
          'announcements': _loadBool(_notifAnnouncKey, true),
        });

  static bool _loadBool(String key, bool def) {
    try {
      return Hive.box(_settingsBox).get(key, defaultValue: def) as bool;
    } catch (_) {
      return def;
    }
  }

  Future<void> toggle(String key) async {
    final updated = {...state, key: !(state[key] ?? true)};
    state = updated;
    // Persist locally
    try {
      final box = Hive.box(_settingsBox);
      await box.put(
        key == 'verse' ? _notifVerseKey : _notifAnnouncKey,
        updated[key],
      );
    } catch (_) {}
    // Sync FCM topic subscription to server
    await _syncTopicSubscription(key, updated[key] ?? true);
  }

  Future<void> _syncTopicSubscription(String key, bool subscribe) async {
    try {
      const storage = FlutterSecureStorage();
      final fcmToken = await storage.read(key: 'fcm_token');
      if (fcmToken == null) return;

      final topicName =
          key == 'verse' ? 'verse-of-day' : 'announcements';
      final endpoint = subscribe
          ? '/api/v1/notifications/topics/subscribe'
          : '/api/v1/notifications/topics/unsubscribe';
      final dio = _ref.read(dioProvider);
      await dio.post(
        endpoint,
        data: {'topic': topicName, 'token': fcmToken},
      );
    } catch (_) {}
  }
}

// ─── Providers ────────────────────────────────────────────────────────────────

final themeProvider =
    StateNotifierProvider<ThemeNotifier, ThemeMode>(
  (_) => ThemeNotifier(),
);

final localeProvider =
    StateNotifierProvider<LocaleNotifier, Locale>(
  (ref) => LocaleNotifier(ref),
);

final notifPrefsProvider =
    StateNotifierProvider<NotifPrefsNotifier, Map<String, bool>>(
  (ref) => NotifPrefsNotifier(ref),
);

Future<void> initSettingsBox() async {
  if (!Hive.isBoxOpen(_settingsBox)) {
    await Hive.openBox(_settingsBox);
  }
}
