import 'dart:io';
import 'dart:math';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../core/constants/app_config.dart';
import '../core/constants/storage_keys.dart';
import 'local_store.dart';

/// The facts about this install that the API wants on every request, read once
/// at boot and cached — an interceptor cannot await a platform channel.
///
/// The device id is ours, generated here and kept in the local store. It is not
/// an advertising id or a hardware identifier: those change meaning between OS
/// versions and drag privacy review along with them. This one exists only so
/// push notifications reach the right install and rate limits have something to
/// key on, and it dies with the app's data.
class DeviceService {
  DeviceService._();

  static final DeviceService instance = DeviceService._();

  // Defaults rather than `late`, because the API client reads these on every
  // request and a half-finished boot must not turn into a thrown error inside
  // an interceptor. Empty is a usable answer; an exception is not.
  String _deviceId = '';
  String _platform = '';
  String _appVersion = '';
  String? _deviceModel;
  String? _osVersion;
  String _timezone = AppConfig.fallbackTimezone;

  String get deviceId => _deviceId;
  String get platform => _platform;
  String get appVersion => _appVersion;
  String? get deviceModel => _deviceModel;
  String? get osVersion => _osVersion;
  String get timezone => _timezone;

  Future<void> init() async {
    _platform = Platform.isIOS ? 'ios' : 'android';
    _deviceId = await _readOrCreateDeviceId();

    try {
      final info = await PackageInfo.fromPlatform();
      _appVersion = '${info.version}+${info.buildNumber}';
    } catch (_) {
      // Nothing downstream needs a version badly enough to fail the launch.
      _appVersion = '';
    }

    _timezone = await _readTimezone();
    await _readDeviceDetails();
  }

  /// What sign-in sends so the backend can attach a device row in the same call.
  Map<String, dynamic> get signInFields => {
        'deviceId': _deviceId,
        'platform': _platform,
        if (_deviceModel != null) 'deviceModel': _deviceModel,
        if (_osVersion != null) 'osVersion': _osVersion,
        'appVersion': _appVersion,
      };

  Future<String> _readOrCreateDeviceId() async {
    final existing = LocalStore.instance.read<String>(BoxKeys.deviceId);
    if (existing != null && existing.isNotEmpty) return existing;

    final created = _randomId();
    await LocalStore.instance.write(BoxKeys.deviceId, created);
    return created;
  }

  static String _randomId() {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    final random = Random.secure();
    return List.generate(24, (_) => alphabet[random.nextInt(alphabet.length)]).join();
  }

  Future<String> _readTimezone() async {
    try {
      final zone = await FlutterTimezone.getLocalTimezone();
      return zone.identifier;
    } catch (_) {
      // A missing zone must not stop launch — the server has its own default.
      return AppConfig.fallbackTimezone;
    }
  }

  Future<void> _readDeviceDetails() async {
    try {
      final plugin = DeviceInfoPlugin();
      if (Platform.isIOS) {
        final ios = await plugin.iosInfo;
        _deviceModel = ios.utsname.machine;
        _osVersion = 'iOS ${ios.systemVersion}';
      } else {
        final android = await plugin.androidInfo;
        _deviceModel = '${android.manufacturer} ${android.model}';
        _osVersion = 'Android ${android.version.release}';
      }
    } catch (_) {
      _deviceModel = null;
      _osVersion = null;
    }
  }
}
