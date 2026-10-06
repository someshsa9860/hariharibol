import 'package:hive_ce_flutter/hive_flutter.dart';

import '../core/constants/storage_keys.dart';

/// The small, non-sensitive key-value store: cached user, device id, theme,
/// last-seen flags. One box, opened at boot.
///
/// Credentials do not come here — they live in `flutter_secure_storage`, behind
/// [AppSession]. Content does not come here either; that is Drift's job.
class LocalStore {
  LocalStore._();

  static final LocalStore instance = LocalStore._();

  Box<dynamic>? _box;

  /// Called once from `main()`, before the first frame.
  Future<void> init() async {
    await Hive.initFlutter();
    _box = await Hive.openBox<dynamic>(BoxNames.app);
  }

  Box<dynamic> get _open {
    final box = _box;
    if (box == null) {
      throw StateError('LocalStore.init() must run before the store is used');
    }
    return box;
  }

  T? read<T>(String key) {
    final value = _open.get(key);
    return value is T ? value : null;
  }

  Map<String, dynamic>? readJson(String key) {
    final value = _open.get(key);
    return value is Map ? Map<String, dynamic>.from(value) : null;
  }

  Future<void> write(String key, Object? value) => _open.put(key, value);

  Future<void> delete(String key) => _open.delete(key);

  /// Wipes everything this store holds. Used on sign-out, alongside clearing
  /// the tokens and the offline database.
  Future<void> clear() => _open.clear();
}
