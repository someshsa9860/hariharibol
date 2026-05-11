import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

const _settingsBox = 'settings';
const _themeKey = 'themeMode';
const _localeKey = 'locale';
const _notifVerseKey = 'notifVerse';
const _notifAnnouncKey = 'notifAnnounc';

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

class LocaleNotifier extends StateNotifier<Locale> {
  LocaleNotifier() : super(_loadLocale());

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
    try {
      final box = Hive.box(_settingsBox);
      await box.put(_localeKey, locale.languageCode);
    } catch (_) {}
  }
}

class NotifPrefsNotifier extends StateNotifier<Map<String, bool>> {
  NotifPrefsNotifier()
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
      final box = Hive.box(_settingsBox);
      await box.put(
          key == 'verse' ? _notifVerseKey : _notifAnnouncKey,
          updated[key]);
    } catch (_) {}
  }
}

final themeProvider =
    StateNotifierProvider<ThemeNotifier, ThemeMode>(
  (_) => ThemeNotifier(),
);

final localeProvider =
    StateNotifierProvider<LocaleNotifier, Locale>(
  (_) => LocaleNotifier(),
);

final notifPrefsProvider =
    StateNotifierProvider<NotifPrefsNotifier, Map<String, bool>>(
  (_) => NotifPrefsNotifier(),
);

Future<void> initSettingsBox() async {
  if (!Hive.isBoxOpen(_settingsBox)) {
    await Hive.openBox(_settingsBox);
  }
}
