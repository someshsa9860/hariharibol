import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../core/constants/chat_config.dart';

/// Where a picture for Ask Sakha comes from.
enum PictureSource { camera, gallery }

/// The reader said no to the camera or the photo library — in the system's
/// own sheet, now or earlier. The screen words it; this only names it.
class PictureAccessDenied implements Exception {
  const PictureAccessDenied(this.source);

  final PictureSource source;

  @override
  String toString() => 'PictureAccessDenied($source)';
}

/// Takes or chooses one picture and hands back the file's path, or null when
/// the reader backs out. A class behind a provider so a test can answer
/// without a camera.
abstract class ChatImagePicker {
  Future<String?> pick(PictureSource source);
}

/// The phone's own camera and photo library.
///
/// The picker scales and compresses the picture itself, so what is uploaded is
/// already a fraction of what the camera made — the server shrinks it again
/// and strips what it carries (place, time) before it is kept.
class DeviceImagePicker implements ChatImagePicker {
  DeviceImagePicker({ImagePicker? picker}) : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  /// The codes `image_picker` raises when the system permission is refused.
  static const _denied = {'camera_access_denied', 'photo_access_denied'};

  @override
  Future<String?> pick(PictureSource source) async {
    try {
      final file = await _picker.pickImage(
        source: source == PictureSource.camera ? ImageSource.camera : ImageSource.gallery,
        maxWidth: ChatConfig.imageMaxEdge,
        maxHeight: ChatConfig.imageMaxEdge,
        imageQuality: ChatConfig.imageQuality,
      );
      return file?.path;
    } on PlatformException catch (error) {
      if (_denied.contains(error.code)) throw PictureAccessDenied(source);
      rethrow;
    }
  }
}
