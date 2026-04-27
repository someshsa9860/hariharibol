import 'package:uuid/uuid.dart';
import 'hive_storage.dart';

class DeviceIdProvider {
  static const String deviceIdKey = 'device_id';

  static Future<String> getDeviceId() async {
    String? deviceId = HiveStorage.get(deviceIdKey) as String?;

    if (deviceId != null) {
      return deviceId;
    }

    // Generate new device id
    const uuid = Uuid();
    deviceId = uuid.v4();

    // Store it
    await HiveStorage.put(deviceIdKey, deviceId);

    return deviceId;
  }
}