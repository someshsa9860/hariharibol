import 'package:hive_flutter/hive_flutter.dart';

class HiveStorage {
  static const String boxName = 'app_cache';

  static Future<void> init() async {
    await Hive.initFlutter();
    await Hive.openBox(boxName);
  }

  static Box get box => Hive.box(boxName);

  static Future<void> put(String key, dynamic value) async {
    await box.put(key, value);
  }

  static dynamic get(String key) {
    return box.get(key);
  }

  static Future<void> delete(String key) async {
    await box.delete(key);
  }

  static Future<void> clear() async {
    await box.clear();
  }
}