import 'dart:io';
import 'dart:math';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../core/constants/app_config.dart';
import '../core/session/token_store.dart';

/// Facts about this phone that every request carries. The device id is generated once and kept in secure
/// storage; the server keeps one `Device` row per id, which is where this app's push token is stored (as `app: dev`).
class DeviceService {
  DeviceService._();

  static final DeviceService instance = DeviceService._();

  static const TokenStore _store = TokenStore();

  String deviceId = '';
  String platform = 'android';
  String appVersion = '1.0.0';
  String? model;
  String? osVersion;
  String timezone = AppConfig.fallbackTimezone;

  Future<void> init() async {
    var id = await _store.readDeviceId();
    if (id == null || id.isEmpty) {
      final random = Random.secure();
      id = 'dev-${List.generate(16, (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0')).join()}';
      await _store.writeDeviceId(id);
    }
    deviceId = id;
    platform = Platform.isIOS ? 'ios' : 'android';

    try {
      appVersion = (await PackageInfo.fromPlatform()).version;
      final info = DeviceInfoPlugin();
      if (Platform.isIOS) {
        final ios = await info.iosInfo;
        model = ios.utsname.machine;
        osVersion = ios.systemVersion;
      } else {
        final android = await info.androidInfo;
        model = android.model;
        osVersion = android.version.release;
      }
    } catch (error) {
      debugPrint('Could not read device facts: $error');
    }
  }

  /// What the sign-in and the device registration carry.
  Map<String, dynamic> get fields => {
        'deviceId': deviceId,
        'platform': platform,
        'appVersion': appVersion,
        'deviceModel': ?model,
        'osVersion': ?osVersion,
      };
}
