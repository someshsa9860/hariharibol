import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../../../home/presentation/providers/home_provider.dart';

const _settingsBox = 'settings';
const _themeKey = 'themeMode';
const _localeKey = 'locale';
const _notifVerseKey = 'notifVerse';
const _notifAnnouncKey = 'notifAnnounc';
const _fontSizeKey = 'fontSize';

// ─── Theme ────────────────────────────────────────────────────────────────────

class ThemeNotifier extends StateNotifier<ThemeMode> {
  ThemeNotifier() : super(_load());

  static ThemeMode _load() {
    try {
      final s =
          Hive.box(_settingsBox).get(_themeKey, defaultValue: 'system') as String;
      return _parse(s);
    } catch (_) {
      return ThemeMode.system;
    }
  }

  static ThemeMode _parse(String s) {
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
      await Hive.box(_settingsBox).put(_themeKey, mode.name);
    } catch (_) {}
  }
}

// ─── Locale ───────────────────────────────────────────────────────────────────

class LocaleNotifier extends StateNotifier<Locale> {
  final Ref _ref;
  LocaleNotifier(this._ref) : super(_load());

  static Locale _load() {
    try {
      final s =
          Hive.box(_settingsBox).get(_localeKey, defaultValue: 'en') as String;
      return Locale(s);
    } catch (_) {
      return const Locale('en');
    }
  }

  Future<void> setLocale(Locale locale) async {
    state = locale;
    try {
      await Hive.box(_settingsBox).put(_localeKey, locale.languageCode);
    } catch (_) {}
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
    try {
      await Hive.box(_settingsBox).put(
        key == 'verse' ? _notifVerseKey : _notifAnnouncKey,
        updated[key],
      );
    } catch (_) {}
    await _syncTopic(key, updated[key] ?? true);
  }

  Future<void> _syncTopic(String key, bool subscribe) async {
    try {
      const storage = FlutterSecureStorage();
      final token = await storage.read(key: 'fcm_token');
      if (token == null) return;
      final topic = key == 'verse' ? 'verse-of-day' : 'announcements';
      final endpoint = subscribe
          ? '/api/v1/notifications/topics/subscribe'
          : '/api/v1/notifications/topics/unsubscribe';
      final dio = _ref.read(dioProvider);
      await dio.post(endpoint, data: {'topic': topic, 'token': token});
    } catch (_) {}
  }
}

// ─── Font Size ────────────────────────────────────────────────────────────────

class FontSizeNotifier extends StateNotifier<double> {
  FontSizeNotifier() : super(_load());

  static double _load() {
    try {
      final v = Hive.box(_settingsBox).get(_fontSizeKey);
      if (v is num) return v.toDouble();
    } catch (_) {}
    return 1.0;
  }

  Future<void> setSize(double size) async {
    state = size;
    try {
      await Hive.box(_settingsBox).put(_fontSizeKey, size);
    } catch (_) {}
  }
}

// ─── Providers ────────────────────────────────────────────────────────────────

final themeProvider =
    StateNotifierProvider<ThemeNotifier, ThemeMode>(
        (_) => ThemeNotifier());

final localeProvider =
    StateNotifierProvider<LocaleNotifier, Locale>(
        (ref) => LocaleNotifier(ref));

final notifPrefsProvider =
    StateNotifierProvider<NotifPrefsNotifier, Map<String, bool>>(
        (ref) => NotifPrefsNotifier(ref));

final fontSizeProvider =
    StateNotifierProvider<FontSizeNotifier, double>(
        (_) => FontSizeNotifier());

final packageInfoProvider = FutureProvider<PackageInfo>(
    (_) => PackageInfo.fromPlatform());

Future<void> initSettingsBox() async {
  if (!Hive.isBoxOpen(_settingsBox)) {
    await Hive.openBox(_settingsBox);
  }
}
